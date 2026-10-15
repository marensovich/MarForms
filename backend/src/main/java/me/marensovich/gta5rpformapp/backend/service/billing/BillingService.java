package me.marensovich.gta5rpformapp.backend.service.billing;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import me.marensovich.gta5rpformapp.backend.database.entity.StripeEvent;
import me.marensovich.gta5rpformapp.backend.database.entity.Subscription;
import me.marensovich.gta5rpformapp.backend.database.entity.Workspace;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.StripeEventRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubscriptionRepository;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.service.jobs.OutboundJobService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Subscriptions through Stripe (E4.2, ADR 0004). A workspace subscribes;
 * its guilds get the paid tier while Stripe reports the subscription as
 * {@code active}, {@code trialing} or {@code past_due} (Stripe's own retry
 * window), and go back to {@code FREE} once it ends — for a cancellation,
 * at the end of the paid period, when Stripe deletes the subscription.
 * <p>
 * Webhooks are verified, recorded by event id (Stripe redelivers) and
 * queued in {@code outbound_jobs}; {@link StripeEventProcessor} applies them,
 * with retries, like Discord webhook delivery (ADR 0001).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BillingService {

    public static final String JOB_TYPE_STRIPE_EVENT = "stripe_event";
    static final Set<String> HANDLED_EVENTS = Set.of(
            "checkout.session.completed",
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted");
    private static final Set<String> PAID_STATUSES = WorkspaceService.LIVE_STATUSES;

    private final StripeProperties stripe;
    private final StripeClient stripeClient;
    private final WorkspaceService workspaceService;
    private final SubscriptionRepository subscriptionRepository;
    private final StripeEventRepository stripeEventRepository;
    private final OutboundJobService outboundJobService;
    private final ObjectMapper objectMapper;
    private final GuildRepository guildRepository;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * A guild's billing as its owner sees it.
     *
     * @param workspaceId       the guild's workspace
     * @param guildCount        how many guilds the subscription covers
     * @param guilds            those guilds, for the merged billing screen (E4.3)
     * @param plan              the workspace's current tier
     * @param status            Stripe's subscription status, {@code none} if never subscribed
     * @param currentPeriodEnd  end of the paid period, if subscribed
     * @param cancelAtPeriodEnd whether it ends then rather than renewing
     * @param billingEnabled    whether checkout is configured on this server
     * @param availablePlans    the tiers that can be bought
     */
    public record BillingStatus(UUID workspaceId, int guildCount, List<GuildRef> guilds, PlanTier plan, String status,
                                LocalDateTime currentPeriodEnd, boolean cancelAtPeriodEnd,
                                boolean billingEnabled, List<PlanTier> availablePlans) {
    }

    /**
     * A guild in a workspace.
     *
     * @param guildId the Discord guild ID (serialized as string)
     * @param name    its name
     */
    public record GuildRef(@JsonSerialize(using = ToStringSerializer.class) Long guildId, String name) {
    }

    /**
     * @param guildId the Discord guild snowflake ID
     * @return its billing status
     * @since v.0.1
     */
    @Transactional
    public BillingStatus status(Long guildId) {
        Workspace workspace = workspaceService.forGuild(guildId);
        Optional<Subscription> sub = subscriptionRepository.findByWorkspaceId(workspace.getId());
        PlanTier plan = sub.filter(s -> PAID_STATUSES.contains(s.getStatus())).map(Subscription::getPlanTier)
                .orElse(PlanTier.FREE);
        List<GuildRef> guilds = workspaceService.guildIds(workspace.getId()).stream()
                .map(id -> new GuildRef(id, guildRepository.findById(id).map(g -> g.getName()).orElse(String.valueOf(id))))
                .toList();
        return new BillingStatus(workspace.getId(), guilds.size(), guilds, plan,
                sub.map(Subscription::getStatus).orElse("none"),
                sub.map(Subscription::getCurrentPeriodEnd).orElse(null),
                sub.map(Subscription::isCancelAtPeriodEnd).orElse(false),
                stripe.enabled(), List.copyOf(stripe.prices().keySet()));
    }

    /**
     * Starts a Stripe Checkout for a paid tier.
     *
     * @param guildId the guild whose workspace subscribes
     * @param plan    the tier to buy
     * @return the Checkout URL to send the owner to
     * @throws InvalidStateException if billing isn't configured or the workspace is already subscribed
     * @since v.0.1
     */
    @Transactional
    public String checkout(Long guildId, PlanTier plan) {
        requireEnabled();
        String price = stripe.prices().get(plan);
        if (price == null) throw new IllegalArgumentException("The " + plan + " plan can't be bought");
        Workspace workspace = workspaceService.forGuild(guildId);
        Subscription sub = subscriptionRepository.findByWorkspaceId(workspace.getId()).orElseGet(() -> {
            Subscription s = new Subscription();
            s.setWorkspaceId(workspace.getId());
            s.setPlanTier(PlanTier.FREE);
            s.setStatus("none");
            return s;
        });
        if (PAID_STATUSES.contains(sub.getStatus())) {
            throw new InvalidStateException("This server already has a subscription: manage it in the billing portal");
        }
        if (sub.getStripeCustomerId() == null) {
            sub.setStripeCustomerId(stripeClient.createCustomer(workspace.getName(), workspace.getId().toString()));
        }
        sub.setUpdatedAt(LocalDateTime.now());
        subscriptionRepository.save(sub);
        String back = frontendUrl + "/dashboard/servers/" + guildId + "/billing?billing=" + guildId;
        return stripeClient.createCheckoutSession(sub.getStripeCustomerId(), price, workspace.getId().toString(),
                plan.name(), back + "&checkout=success", back + "&checkout=cancel");
    }

    /**
     * Opens the Stripe Billing Portal, where the owner changes plan, updates
     * the card or cancels.
     *
     * @param guildId the guild whose workspace is billed
     * @return the portal URL
     * @throws InvalidStateException if billing isn't configured or there is no customer yet
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public String portal(Long guildId) {
        requireEnabled();
        Workspace workspace = workspaceService.forGuild(guildId);
        String customer = subscriptionRepository.findByWorkspaceId(workspace.getId())
                .map(Subscription::getStripeCustomerId)
                .orElseThrow(() -> new InvalidStateException("There is no subscription to manage yet"));
        return stripeClient.createPortalSession(customer, frontendUrl + "/dashboard/servers/" + guildId + "/billing");
    }

    /**
     * Accepts a Stripe webhook: verifies it, records its id (a redelivery
     * is acknowledged without being applied again) and queues it.
     *
     * @param payload   the raw body
     * @param signature the {@code Stripe-Signature} header
     * @return {@code false} if the signature is invalid
     * @since v.0.1
     */
    @Transactional
    public boolean acceptWebhook(String payload, String signature) {
        if (!StripeWebhookVerifier.isValid(payload, signature, stripe.webhookSecret(), Instant.now())) return false;
        JsonNode event;
        try {
            event = objectMapper.readTree(payload);
        } catch (JsonProcessingException e) {
            return false;
        }
        String id = event.path("id").asText(null);
        String type = event.path("type").asText("");
        if (id == null) return false;
        if (stripeEventRepository.existsById(id)) return true;
        stripeEventRepository.save(new StripeEvent(id, type.length() > 100 ? type.substring(0, 100) : type,
                LocalDateTime.now()));
        if (HANDLED_EVENTS.contains(type)) {
            Map<String, Object> job = new LinkedHashMap<>();
            job.put("eventId", id);
            job.put("type", type);
            job.put("created", event.path("created").asLong());
            job.put("object", objectMapper.convertValue(event.path("data").path("object"), Map.class));
            outboundJobService.enqueue(JOB_TYPE_STRIPE_EVENT, job);
        }
        return true;
    }

    /**
     * Applies one queued Stripe event to the workspace's subscription and
     * its guilds' plan.
     *
     * @param type    the event type
     * @param created when Stripe created the event (unix seconds)
     * @param object  the event's {@code data.object}
     * @since v.0.1
     */
    @Transactional
    public void apply(String type, long created, JsonNode object) {
        LocalDateTime eventTime = toLocal(created);
        if (type.equals("checkout.session.completed")) {
            UUID workspaceId = uuid(object.path("client_reference_id").asText(null));
            if (workspaceId == null) return;
            Subscription sub = subscriptionFor(workspaceId);
            sub.setStripeCustomerId(text(object, "customer", sub.getStripeCustomerId()));
            sub.setStripeSubscriptionId(text(object, "subscription", sub.getStripeSubscriptionId()));
            sub.setUpdatedAt(LocalDateTime.now());
            subscriptionRepository.save(sub);
            return;
        }

        // customer.subscription.created / updated / deleted
        String stripeSubId = object.path("id").asText(null);
        UUID workspaceId = uuid(object.path("metadata").path("workspaceId").asText(null));
        Subscription sub = (workspaceId != null ? subscriptionRepository.findByWorkspaceId(workspaceId) : Optional.<Subscription>empty())
                .or(() -> stripeSubId == null ? Optional.empty() : subscriptionRepository.findByStripeSubscriptionId(stripeSubId))
                .or(() -> subscriptionRepository.findByStripeCustomerId(object.path("customer").asText("")))
                .orElseGet(() -> workspaceId != null ? subscriptionFor(workspaceId) : null);
        if (sub == null) {
            log.warn("Stripe subscription {} matches no workspace, ignoring", stripeSubId);
            return;
        }
        if (sub.getLastEventAt() != null && eventTime.isBefore(sub.getLastEventAt())) {
            log.info("Ignoring an out-of-order Stripe event for subscription {}", stripeSubId);
            return;
        }

        String status = type.equals("customer.subscription.deleted") ? "canceled" : object.path("status").asText("unknown");
        if (sub.getStripeSubscriptionId() != null && !sub.getStripeSubscriptionId().equals(stripeSubId)
                && !PAID_STATUSES.contains(status)) {
            // The end of an earlier subscription must not cancel the one that replaced it.
            log.info("Ignoring {} for superseded subscription {}", type, stripeSubId);
            return;
        }
        sub.setStripeSubscriptionId(stripeSubId);
        sub.setStripeCustomerId(text(object, "customer", sub.getStripeCustomerId()));
        sub.setStatus(status.length() > 30 ? status.substring(0, 30) : status);
        sub.setPlanTier(planOf(object));
        sub.setCancelAtPeriodEnd(object.path("cancel_at_period_end").asBoolean(false));
        long periodEnd = object.path("current_period_end").asLong(
                object.path("items").path("data").path(0).path("current_period_end").asLong(0));
        sub.setCurrentPeriodEnd(periodEnd > 0 ? toLocal(periodEnd) : sub.getCurrentPeriodEnd());
        sub.setLastEventAt(eventTime);
        sub.setUpdatedAt(LocalDateTime.now());
        subscriptionRepository.save(sub);

        PlanTier effective = PAID_STATUSES.contains(sub.getStatus()) ? sub.getPlanTier() : PlanTier.FREE;
        workspaceService.applyPlan(sub.getWorkspaceId(), effective);
        log.info("Workspace {} subscription is {} → plan {}", sub.getWorkspaceId(), sub.getStatus(), effective);
    }

    private PlanTier planOf(JsonNode subscription) {
        String plan = subscription.path("metadata").path("plan").asText(null);
        if (plan != null) {
            try {
                return PlanTier.valueOf(plan);
            } catch (IllegalArgumentException ignored) {
                // fall through to the price lookup
            }
        }
        String price = subscription.path("items").path("data").path(0).path("price").path("id").asText(null);
        return stripe.prices().entrySet().stream()
                .filter(e -> e.getValue().equals(price))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(PlanTier.PRO);
    }

    private Subscription subscriptionFor(UUID workspaceId) {
        return subscriptionRepository.findByWorkspaceId(workspaceId).orElseGet(() -> {
            Subscription s = new Subscription();
            s.setWorkspaceId(workspaceId);
            s.setPlanTier(PlanTier.FREE);
            s.setStatus("none");
            return s;
        });
    }

    private void requireEnabled() {
        if (!stripe.enabled()) throw new InvalidStateException("Billing is not configured on this server");
    }

    private static String text(JsonNode node, String field, String fallback) {
        String v = node.path(field).asText(null);
        return v == null || v.isBlank() ? fallback : v;
    }

    private static UUID uuid(String s) {
        try {
            return s == null ? null : UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static LocalDateTime toLocal(long epochSeconds) {
        return LocalDateTime.ofInstant(Instant.ofEpochSecond(epochSeconds), ZoneId.systemDefault());
    }
}
