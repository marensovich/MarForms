package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditDiff;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import me.marensovich.gta5rpformapp.backend.database.repository.AuditLogRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordWebhookUrl;
import me.marensovich.gta5rpformapp.backend.service.discord.WebhookUrlCipher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for recording audit log entries and optionally forwarding them
 * to a configured Discord webhook.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private static final String LOG_WEBHOOK_KEY = "log.webhook.url";
    private static final String LOG_ENABLED_ACTIONS_KEY = "log.enabled.actions";
    /** How long the journal keeps an entry (ТЗ 6.5). */
    public static final int RETENTION_DAYS = 365;
    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final AuditLogRepository auditLogRepository;
    private final SettingsService settingsService;
    private final RestTemplate restTemplate;
    private final ApplicationEventPublisher events;
    private volatile Delivery lastDelivery;

    // ── Public logging API ──────────────────────────────────────────────────

    /**
     * Persists a log entry with an explicit actor.
     * Use this when the actor is the subject of the action itself (e.g. login).
     * Returns immediately without saving if the action is disabled via settings.
     *
     * @param action        the type of action being logged
     * @param actorId       the Discord ID of the actor
     * @param actorUsername the username of the actor
     * @param targetId      the identifier of the affected entity
     * @param targetName    the human-readable name of the affected entity
     * @param details       additional context about the action
     * @since v.0.1
     */
    public void log(AuditAction action, Long actorId, String actorUsername,
                    String targetId, String targetName, String details) {
        log(action, actorId, actorUsername, targetId, targetName, details, null);
    }

    /**
     * Like {@link #log(AuditAction, Long, String, String, String, String)},
     * with structured details — the diff of a change ({@link AuditDiff}, ТЗ 6.5).
     *
     * @param metadata structured details, may be {@code null}
     * @since v.0.1
     */
    public void log(AuditAction action, Long actorId, String actorUsername,
                    String targetId, String targetName, String details, Map<String, Object> metadata) {
        if (!isActionEnabled(action)) return;
        AuditLog entry = buildEntry(action, actorId, actorUsername, targetId, targetName, details);
        entry.setMetadata(metadata);
        auditLogRepository.save(entry);
        events.publishEvent(new AuditLogDispatcher.Dispatch(entry));
        events.publishEvent(new AuditLogStream.Saved(entry));
    }

    /**
     * Persists a log entry resolving the actor from the current Spring Security context.
     * Use this for all admin-initiated actions.
     *
     * @param action     the type of action being logged
     * @param targetId   the identifier of the affected entity
     * @param targetName the human-readable name of the affected entity
     * @param details    additional context about the action
     * @since v.0.1
     */
    public void logByCurrentUser(AuditAction action,
                                 String targetId, String targetName, String details) {
        log(action, currentActorId(), currentActorUsername(), targetId, targetName, details, null);
    }

    /**
     * Like {@link #logByCurrentUser(AuditAction, String, String, String)}, with what changed.
     *
     * @param diff the change's fields, before and after
     * @since v.0.1
     */
    public void logByCurrentUser(AuditAction action, String targetId, String targetName, String details, AuditDiff diff) {
        log(action, currentActorId(), currentActorUsername(), targetId, targetName, details, diff.into(null));
    }

    /**
     * Records a moderator action on a guild (E2.5): what its owner reviews
     * on the server's audit screen. The actor is the current user. An action
     * disabled in the platform's journal filters is written nowhere — neither
     * journal nor webhook (ТЗ 6.7).
     *
     * @param guildId    the Discord guild snowflake ID
     * @param action     what happened
     * @param targetType what the target is ({@code SUBMISSION}, {@code USER})
     * @param targetId   the target's ID
     * @param targetName a readable name for the target, may be {@code null}
     * @param metadata   structured details, may be {@code null}
     * @param details    human-readable details, may be {@code null}
     * @since v.0.1
     */
    public void logGuildAction(Long guildId, AuditAction action, String targetType, String targetId,
                               String targetName, Map<String, Object> metadata, String details) {
        logGuildActionAs(currentActorId(), currentActorUsername(), guildId, action, targetType, targetId,
                targetName, metadata, details);
    }

    /**
     * Like {@link #logGuildAction}, for a request with no signed-in user (the
     * bot-install callback): the actor is given explicitly.
     *
     * @since v.0.1
     */
    public void logGuildActionAs(Long actorId, String actorUsername, Long guildId, AuditAction action,
                                 String targetType, String targetId, String targetName,
                                 Map<String, Object> metadata, String details) {
        if (!isActionEnabled(action)) return;
        AuditLog entry = buildEntry(action, actorId, actorUsername, targetId, targetName, details);
        entry.setGuildId(guildId);
        entry.setTargetType(targetType);
        entry.setMetadata(metadata);
        auditLogRepository.save(entry);
        events.publishEvent(new AuditLogDispatcher.Dispatch(entry));
        events.publishEvent(new AuditLogStream.Saved(entry));
    }

    /**
     * A page of a guild's journal for its feed (ТЗ 4.6.2): newest first, after
     * the cursor of the previous page, so new entries never shift what was loaded.
     *
     * @param guildId        the Discord guild snowflake ID
     * @param actions        the actions to show; empty or {@code null} = any
     * @param actorDiscordId optional filter by who acted
     * @param since          optional lower bound of the period
     * @param cursor         {@link #cursorOf} of the last entry already shown, or {@code null}
     * @param size           how many entries
     * @return the entries, one more than {@code size} if there are more
     * @since v.0.1
     */
    public List<AuditLog> feedForGuild(Long guildId, java.util.Set<AuditAction> actions, Long actorDiscordId,
                                       LocalDateTime since, String cursor, int size) {
        Specification<AuditLog> spec = guildSpec(guildId, actions, actorDiscordId, since);
        if (cursor != null && !cursor.isBlank()) {
            int bar = cursor.indexOf('|');
            if (bar < 0) throw new IllegalArgumentException("Bad cursor");
            LocalDateTime at = LocalDateTime.parse(cursor.substring(0, bar));
            UUID id = UUID.fromString(cursor.substring(bar + 1));
            spec = spec.and((root, query, cb) -> cb.or(cb.lessThan(root.<LocalDateTime>get("createdAt"), at),
                    cb.and(cb.equal(root.get("createdAt"), at), cb.lessThan(root.<UUID>get("id"), id))));
        }
        return auditLogRepository.findAll(spec, org.springframework.data.domain.PageRequest.of(0, size + 1,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")))).getContent();
    }

    /** Where the next feed page starts: after this entry. */
    public static String cursorOf(AuditLog entry) {
        return entry.getCreatedAt() + "|" + entry.getId();
    }

    /** Everyone who has acted in a guild's journal, for its «Кто» filter. */
    public List<AuditLogRepository.Actor> actorsOfGuild(Long guildId) {
        return auditLogRepository.findActorsByGuildId(guildId);
    }

    private static Specification<AuditLog> guildSpec(Long guildId, java.util.Set<AuditAction> actions,
                                                     Long actorDiscordId, LocalDateTime since) {
        Specification<AuditLog> spec = (root, query, cb) -> cb.equal(root.get("guildId"), guildId);
        if (actions != null && !actions.isEmpty()) spec = spec.and((root, query, cb) -> root.get("action").in(actions));
        if (actorDiscordId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("actorDiscordId"), actorDiscordId));
        }
        if (since != null) spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.<LocalDateTime>get("createdAt"), since));
        return spec;
    }

    // ── Query ───────────────────────────────────────────────────────────────

    /**
     * The platform journal (ТЗ 6.5), newest first.
     *
     * @param actions     the actions to show; empty or {@code null} = any
     * @param participant a Discord ID: who acted <b>or</b> who was acted on
     * @param from        the first day, inclusive
     * @param to          the last day, inclusive
     * @param pageable    the page
     * @return the entries
     * @since v.0.1
     */
    public Page<AuditLog> search(Set<AuditAction> actions, Long participant, java.time.LocalDate from, java.time.LocalDate to,
                                 Pageable pageable) {
        return auditLogRepository.findAll((root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> p = new ArrayList<>();
            if (actions != null && !actions.isEmpty()) p.add(root.get("action").in(actions));
            if (participant != null) {
                p.add(cb.or(cb.equal(root.get("actorDiscordId"), participant), cb.equal(root.get("targetId"), String.valueOf(participant))));
            }
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay()));
            if (to != null) p.add(cb.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay()));
            return cb.and(p.toArray(jakarta.persistence.criteria.Predicate[]::new));
        }, pageable);
    }

    /**
     * The journal's KPIs (ТЗ 6.5): all entries; and today's entries, decisions
     * on submissions, bans and time-outs, and changes of rights.
     *
     * @return the counts
     * @since v.0.1
     */
    public Map<String, Long> stats() {
        LocalDateTime today = java.time.LocalDate.now().atStartOfDay();
        return Map.of(
                "total", auditLogRepository.count(),
                "today", countSince(today, null),
                "decisions", countSince(today, Set.of(AuditAction.SUBMISSION_DECIDED)),
                "restrictions", countSince(today, Set.of(AuditAction.USER_BANNED, AuditAction.USER_TIMED_OUT, AuditAction.GUILD_BAN_ADDED)),
                "rights", countSince(today, Set.of(AuditAction.USER_ROLES_UPDATED, AuditAction.ROLE_CREATED, AuditAction.ROLE_UPDATED,
                        AuditAction.ROLE_DELETED)));
    }

    private long countSince(LocalDateTime since, Set<AuditAction> actions) {
        return auditLogRepository.count((root, query, cb) -> actions == null
                ? cb.greaterThanOrEqualTo(root.get("createdAt"), since)
                : cb.and(cb.greaterThanOrEqualTo(root.get("createdAt"), since), root.get("action").in(actions)));
    }

    /**
     * Drops entries older than 365 days (ТЗ 6.5), every night.
     *
     * @return how many were dropped
     * @since v.0.1
     */
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 30 3 * * *")
    @org.springframework.transaction.annotation.Transactional
    public int purgeExpired() {
        int dropped = auditLogRepository.deleteOlderThan(LocalDateTime.now().minusDays(RETENTION_DAYS));
        if (dropped > 0) log.info("Audit log retention: dropped {} entries older than {} days", dropped, RETENTION_DAYS);
        return dropped;
    }

    // ── Security context helpers ────────────────────────────────────────────

    /**
     * Retrieves the Discord ID of the currently authenticated user.
     *
     * @return the Discord ID, or {@code null} if no user is authenticated
     * @since v.0.1
     */
    public Long currentActorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails d) {
            return d.getDiscordId();
        }
        return null;
    }

    /**
     * Retrieves the Discord username of the currently authenticated user.
     *
     * @return the username, or {@code null} if no user is authenticated
     * @since v.0.1
     */
    public String currentActorUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails d) {
            return d.getUser().getDiscordUsername();
        }
        return null;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    /**
     * Returns {@code true} if the given action should be recorded.
     * An empty setting means all actions are enabled.
     * Otherwise only the actions explicitly listed (comma-separated) are enabled.
     *
     * @param action the action to check
     * @return {@code true} if the action is enabled, {@code false} otherwise
     * @since v.0.1
     */
    private boolean isActionEnabled(AuditAction action) {
        String raw = settingsService.get(LOG_ENABLED_ACTIONS_KEY, "");
        if (raw == null || raw.isBlank()) return true;
        Set<String> enabled = Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
        return enabled.contains(action.name());
    }

    /**
     * Builds an {@link AuditLog} entity from the provided parameters.
     *
     * @param action        the type of action
     * @param actorId       the Discord ID of the actor
     * @param actorUsername the username of the actor
     * @param targetId      the identifier of the affected entity
     * @param targetName    the human-readable name of the affected entity
     * @param details       additional context about the action
     * @return the constructed {@link AuditLog} entity
     * @since v.0.1
     */
    private AuditLog buildEntry(AuditAction action, Long actorId, String actorUsername,
                                String targetId, String targetName, String details) {
        AuditLog entry = new AuditLog();
        entry.setAction(action);
        entry.setActorDiscordId(actorId);
        entry.setActorUsername(actorUsername);
        entry.setTargetId(targetId);
        entry.setTargetName(targetName);
        entry.setDetails(details);
        return entry;
    }

    /**
     * Sends an audit log entry to the configured Discord webhook. Called by
     * {@link AuditLogDispatcher} off the request thread, after the action's
     * transaction committed — never inline, so a slow Discord doesn't hold
     * up the request or its database connection (#103).
     *
     * @param entry the audit log entry to dispatch
     * @since v.0.1
     */
    void dispatch(AuditLog entry) {
        String url = settingsService.get(LOG_WEBHOOK_KEY, null);
        if (url == null || url.isBlank()) return;
        DiscordWebhookUrl webhook = DiscordWebhookUrl.parse(url).orElse(null);
        if (webhook == null) {
            log.warn("Audit log webhook setting is not a Discord webhook URL — not dispatching");
            return;
        }
        Delivery d = post(webhook, List.of(buildEmbed(entry)));
        if (!d.ok()) log.warn("Audit log Discord dispatch failed: {}", d.status());
    }

    /**
     * How the journal webhook last answered (ТЗ 6.7 «Последняя доставка»).
     *
     * @param ok     Discord took the message
     * @param status the HTTP status, or why it failed
     * @param at     when
     */
    public record Delivery(boolean ok, String status, LocalDateTime at) {
    }

    /** The last delivery to the journal webhook since the start, {@code null} if none. */
    public Delivery lastDelivery() {
        return lastDelivery;
    }

    /**
     * «Отправить тест» (ТЗ 6.7): a test message to the given journal webhook,
     * or to the saved one if none is given.
     *
     * @param url a Discord webhook URL, may be {@code null}
     * @return how it went
     * @throws IllegalArgumentException if there is no Discord webhook to send to
     * @since v.0.1
     */
    public Delivery testWebhook(String url) {
        String target = url != null && !url.isBlank() ? url : settingsService.get(LOG_WEBHOOK_KEY, null);
        DiscordWebhookUrl webhook = target == null ? null : DiscordWebhookUrl.parse(target).orElse(null);
        if (webhook == null) throw new IllegalArgumentException("That's not a Discord webhook URL");
        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", "MarForms · проверка журнала");
        embed.put("description", "Сюда будут приходить записи журнала платформы. Отвечать на это сообщение не нужно.");
        embed.put("color", 0x5865F2);
        embed.put("timestamp", java.time.OffsetDateTime.now().toString());
        return post(webhook, List.of(embed));
    }

    private Delivery post(DiscordWebhookUrl webhook, List<Map<String, Object>> embeds) {
        Delivery d;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            var response = restTemplate.postForEntity(webhook.canonical(), new HttpEntity<>(Map.of("embeds", embeds), headers), String.class);
            d = new Delivery(true, String.valueOf(response.getStatusCode().value()), LocalDateTime.now());
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            d = new Delivery(false, String.valueOf(e.getStatusCode().value()), LocalDateTime.now());
        } catch (Exception e) {
            d = new Delivery(false, WebhookUrlCipher.redact(e.getMessage()), LocalDateTime.now());
        }
        lastDelivery = d;
        return d;
    }

    /**
     * Builds a Discord embed from an audit log entry.
     *
     * @param entry the audit log entry
     * @return a {@link Map} representing the Discord embed
     * @since v.0.1
     */
    private Map<String, Object> buildEmbed(AuditLog entry) {
        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", formatActionTitle(entry.getAction()));
        embed.put("color", actionColor(entry.getAction()));
        embed.put("timestamp", entry.getCreatedAt().atOffset(java.time.ZoneOffset.UTC).toString());

        List<Map<String, Object>> fields = new ArrayList<>();

        if (entry.getActorUsername() != null || entry.getActorDiscordId() != null) {
            String actor;
            if (entry.getActorDiscordId() != null) {
                actor = "<@" + entry.getActorDiscordId() + "> (" + entry.getActorDiscordId() + ")";
                if (entry.getActorUsername() != null) {
                    actor += "\n" + entry.getActorUsername();
                }
            } else {
                actor = entry.getActorUsername();
            }
            fields.add(embedField("Actor", actor, true));
        }

        if (entry.getTargetName() != null || entry.getTargetId() != null) {
            StringBuilder target = new StringBuilder();
            if (entry.getTargetName() != null) target.append(entry.getTargetName());
            if (entry.getTargetId() != null) {
                if (!target.isEmpty()) target.append("\n");
                target.append("`").append(entry.getTargetId()).append("`");
            }
            fields.add(embedField("Target", target.toString(), true));
        }

        if (entry.getDetails() != null && !entry.getDetails().isBlank()) {
            String formatted = entry.getDetails().lines()
                    .map(l -> l.contains(" → ") ? "```" + l + "```" : l)
                    .reduce("", (a, b) -> a.isBlank() ? b : a + "\n" + b);
            fields.add(embedField("Changes", formatted.isBlank() ? entry.getDetails() : formatted, false));
        }

        embed.put("fields", fields);

        Map<String, String> footer = new LinkedHashMap<>();
        footer.put("text", "MarForms Audit Log");
        embed.put("footer", footer);

        return embed;
    }

    /**
     * Creates a Discord embed field.
     *
     * @param name   the field name
     * @param value  the field value
     * @param inline whether the field should be inline
     * @return a {@link Map} representing the embed field
     * @since v.0.1
     */
    private Map<String, Object> embedField(String name, String value, boolean inline) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("name", name);
        f.put("value", value.length() > 1024 ? value.substring(0, 1021) + "…" : value);
        f.put("inline", inline);
        return f;
    }

    /**
     * Formats an audit action as a human-readable title with an emoji.
     *
     * @param action the audit action
     * @return a formatted title string
     * @since v.0.1
     */
    private String formatActionTitle(AuditAction action) {
        return switch (action) {
            case USER_LOGIN -> "🔵 User Login";
            case USER_BANNED -> "🔴 User Banned";
            case USER_UNBANNED -> "🟢 User Unbanned";
            case USER_TIMED_OUT -> "🟠 User Timed Out";
            case USER_TIMEOUT_LIFTED -> "🟢 Time-out Lifted";
            case USER_ROLES_UPDATED -> "🟡 User Roles Updated";
            case FORM_CREATED -> "🟢 Form Created";
            case FORM_UPDATED -> "🔵 Form Updated";
            case FORM_DELETED -> "🔴 Form Deleted";
            case SUBMISSION_CREATED -> "🟢 Submission Created";
            case SUBMISSION_DELETED -> "🔴 Submission Deleted";
            case SUBMISSION_DECIDED -> "🟣 Submission Decided";
            case SUBMISSION_DM_FAILED -> "✉️ Decision DM Not Delivered";
            case ROLE_CREATED -> "🟢 Role Created";
            case ROLE_UPDATED -> "🔵 Role Updated";
            case ROLE_DELETED -> "🔴 Role Deleted";
            case SETTINGS_UPDATED -> "🟡 Settings Updated";
            case MODERATOR_ADDED -> "🟢 Moderator Added";
            case MODERATOR_REMOVED -> "🔴 Moderator Removed";
            case MODERATOR_FORMS_CHANGED -> "🟡 Moderator Forms Changed";
            case GUILD_BAN_ADDED -> "🔴 Server Ban Added";
            case GUILD_BAN_REMOVED -> "🟢 Server Ban Removed";
            case GUILD_CONNECTED -> "🔗 Server Connected";
            case GUILD_ROLE_REVOKED -> "🔴 Server Role Revoked";
            case FORM_STATUS_CHANGED -> "🔵 Form Status Changed";
            case BOT_REMOVED -> "🔴 Bot Removed From Server";
            case BOT_RECONNECTED -> "🟢 Bot Back On Server";
            case BOT_PERMISSIONS_MISSING -> "🟡 Bot Lacks Permissions";
            case WEBHOOK_FAILING -> "🟡 Webhook Not Delivering";
        };
    }

    /**
     * Returns the color code for a given audit action.
     *
     * @param action the audit action
     * @return the hexadecimal color code
     * @since v.0.1
     */
    private int actionColor(AuditAction action) {
        return switch (action) {
            case USER_UNBANNED, USER_TIMEOUT_LIFTED, FORM_CREATED, SUBMISSION_CREATED, ROLE_CREATED, MODERATOR_ADDED, GUILD_BAN_REMOVED, GUILD_CONNECTED -> 0x57F287;
            case USER_BANNED, FORM_DELETED, SUBMISSION_DELETED, ROLE_DELETED, MODERATOR_REMOVED, GUILD_BAN_ADDED, GUILD_ROLE_REVOKED -> 0xED4245;
            case USER_LOGIN, FORM_UPDATED, ROLE_UPDATED -> 0x5865F2;
            case USER_ROLES_UPDATED, SETTINGS_UPDATED, MODERATOR_FORMS_CHANGED -> 0xFEE75C;
            case SUBMISSION_DECIDED -> 0xEB459E;
            case SUBMISSION_DM_FAILED, BOT_PERMISSIONS_MISSING, WEBHOOK_FAILING, USER_TIMED_OUT -> 0xFEE75C;
            case FORM_STATUS_CHANGED -> 0x5865F2;
            case BOT_REMOVED -> 0xED4245;
            case BOT_RECONNECTED -> 0x57F287;
        };
    }
}