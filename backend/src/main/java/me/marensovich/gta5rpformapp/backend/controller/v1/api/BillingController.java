package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import me.marensovich.gta5rpformapp.backend.service.billing.BillingService;
import me.marensovich.gta5rpformapp.backend.service.billing.WorkspaceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Subscriptions (E4.2/E4.3): status, Stripe Checkout and Billing Portal for
 * a guild's owner, sharing one subscription between servers, and Stripe's
 * webhook endpoint.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;
    private final WorkspaceService workspaceService;

    /**
     * A plan to buy.
     *
     * @param plan the tier
     */
    public record CheckoutRequest(PlanTier plan) {
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @GetMapping("/api/v1/guilds/{guildId}/billing")
    public BillingService.BillingStatus status(@PathVariable Long guildId) {
        return billingService.status(guildId);
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PostMapping("/api/v1/guilds/{guildId}/billing/checkout")
    public Map<String, String> checkout(@PathVariable Long guildId, @RequestBody CheckoutRequest request) {
        if (request == null || request.plan() == null) throw new IllegalArgumentException("Choose a plan");
        return Map.of("url", billingService.checkout(guildId, request.plan()));
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PostMapping("/api/v1/guilds/{guildId}/billing/portal")
    public Map<String, String> portal(@PathVariable Long guildId) {
        return Map.of("url", billingService.portal(guildId));
    }

    /**
     * Which subscription a server should join.
     *
     * @param targetGuildId a server already in that subscription's workspace
     */
    public record JoinRequest(Long targetGuildId) {
    }

    /**
     * Puts a server under another server's subscription (E4.3, #100): one
     * owner pays once for several servers. The caller must own both.
     *
     * @param guildId   the server that joins
     * @param request   a server of the workspace to join
     * @param principal the owner
     * @return the joined workspace's billing, as seen from the server that joined
     * @since v.0.1
     */
    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER') and #request != null "
            + "and @guildAccess.hasRole(#request.targetGuildId(), 'OWNER')")
    @PostMapping("/api/v1/guilds/{guildId}/workspace/join")
    public BillingService.BillingStatus join(@PathVariable Long guildId, @RequestBody JoinRequest request,
                                             @AuthenticationPrincipal CustomUserDetails principal) {
        workspaceService.moveGuild(guildId, workspaceService.forGuild(request.targetGuildId()).getId(),
                principal.getUser().getId());
        return billingService.status(guildId);
    }

    /**
     * Takes a server out of a shared subscription; it goes back to the free
     * plan in a workspace of its own.
     *
     * @param guildId the server
     * @return its billing afterwards
     * @since v.0.1
     */
    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PostMapping("/api/v1/guilds/{guildId}/workspace/leave")
    public BillingService.BillingStatus leave(@PathVariable Long guildId) {
        workspaceService.detachGuild(guildId);
        return billingService.status(guildId);
    }

    /**
     * Stripe's webhook endpoint (public; authenticated by its signature).
     *
     * @param payload   the raw body, needed byte-for-byte for the signature
     * @param signature the {@code Stripe-Signature} header
     * @return 200 when accepted (or already seen), 400 when the signature is invalid
     * @since v.0.1
     */
    @PostMapping("/api/v1/public/billing/stripe/webhook")
    public ResponseEntity<Void> webhook(@RequestBody String payload,
                                        @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        return billingService.acceptWebhook(payload, signature)
                ? ResponseEntity.ok().build()
                : ResponseEntity.badRequest().build();
    }
}
