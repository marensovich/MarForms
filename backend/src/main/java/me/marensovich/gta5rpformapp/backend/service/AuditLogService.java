package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import me.marensovich.gta5rpformapp.backend.database.repository.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

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
    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final AuditLogRepository auditLogRepository;
    private final SettingsService settingsService;
    private final RestTemplate restTemplate = new RestTemplate();

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
        if (!isActionEnabled(action)) return;
        AuditLog entry = buildEntry(action, actorId, actorUsername, targetId, targetName, details);
        auditLogRepository.save(entry);
        dispatchAsync(entry);
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
        log(action, currentActorId(), currentActorUsername(), targetId, targetName, details);
    }

    /**
     * Records a moderator action on a guild (E2.5): what its owner reviews
     * on the server's audit screen. The actor is the current user. Always
     * stored, whatever the platform's enabled-actions setting says (that
     * filter is for the platform journal); forwarded to the platform's
     * log webhook only if the action is enabled there.
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
        AuditLog entry = buildEntry(action, currentActorId(), currentActorUsername(), targetId, targetName, details);
        entry.setGuildId(guildId);
        entry.setTargetType(targetType);
        entry.setMetadata(metadata);
        auditLogRepository.save(entry);
        if (isActionEnabled(action)) dispatchAsync(entry);
    }

    /**
     * A guild's audit log, newest first (E2.5).
     *
     * @param guildId        the Discord guild snowflake ID
     * @param action         optional filter by action
     * @param actorDiscordId optional filter by who acted
     * @param pageable       pagination
     * @return the matching entries
     * @since v.0.1
     */
    public Page<AuditLog> listForGuild(Long guildId, AuditAction action, Long actorDiscordId, Pageable pageable) {
        Specification<AuditLog> spec = (root, query, cb) -> cb.equal(root.get("guildId"), guildId);
        if (action != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("action"), action));
        if (actorDiscordId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("actorDiscordId"), actorDiscordId));
        }
        return auditLogRepository.findAll(spec, pageable);
    }

    // ── Query ───────────────────────────────────────────────────────────────

    /**
     * Retrieves a paginated list of audit logs with optional filters.
     *
     * @param action         optional filter by action type
     * @param actorDiscordId optional filter by actor Discord ID
     * @param pageable       pagination parameters
     * @return a {@link Page} of {@link AuditLog} entities matching the filters
     * @since v.0.1
     */
    public Page<AuditLog> listAll(AuditAction action, Long actorDiscordId, Pageable pageable) {
        if (action != null && actorDiscordId != null) {
            return auditLogRepository.findAllByActionAndActorDiscordId(action, actorDiscordId, pageable);
        }
        if (action != null) {
            return auditLogRepository.findAllByAction(action, pageable);
        }
        if (actorDiscordId != null) {
            return auditLogRepository.findAllByActorDiscordId(actorDiscordId, pageable);
        }
        return auditLogRepository.findAll(pageable);
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
     * Asynchronously dispatches an audit log entry to the configured Discord webhook.
     *
     * @param entry the audit log entry to dispatch
     * @since v.0.1
     */
    @Async
    protected void dispatchAsync(AuditLog entry) {
        String url = settingsService.get(LOG_WEBHOOK_KEY, null);
        if (url == null || url.isBlank()) return;
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("embeds", List.of(buildEmbed(entry)));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            restTemplate.postForEntity(url, new HttpEntity<>(payload, headers), String.class);
        } catch (Exception e) {
            log.warn("Audit log Discord dispatch failed: {}", e.getMessage());
        }
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
            case USER_ROLES_UPDATED -> "🟡 User Roles Updated";
            case FORM_CREATED -> "🟢 Form Created";
            case FORM_UPDATED -> "🔵 Form Updated";
            case FORM_DELETED -> "🔴 Form Deleted";
            case SUBMISSION_CREATED -> "🟢 Submission Created";
            case SUBMISSION_DELETED -> "🔴 Submission Deleted";
            case SUBMISSION_DECIDED -> "🟣 Submission Decided";
            case ROLE_CREATED -> "🟢 Role Created";
            case ROLE_UPDATED -> "🔵 Role Updated";
            case ROLE_DELETED -> "🔴 Role Deleted";
            case SETTINGS_UPDATED -> "🟡 Settings Updated";
            case MODERATOR_ADDED -> "🟢 Moderator Added";
            case MODERATOR_REMOVED -> "🔴 Moderator Removed";
            case GUILD_BAN_ADDED -> "🔴 Server Ban Added";
            case GUILD_BAN_REMOVED -> "🟢 Server Ban Removed";
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
            case USER_UNBANNED, FORM_CREATED, SUBMISSION_CREATED, ROLE_CREATED, MODERATOR_ADDED, GUILD_BAN_REMOVED -> 0x57F287;
            case USER_BANNED, FORM_DELETED, SUBMISSION_DELETED, ROLE_DELETED, MODERATOR_REMOVED, GUILD_BAN_ADDED -> 0xED4245;
            case USER_LOGIN, FORM_UPDATED, ROLE_UPDATED -> 0x5865F2;
            case USER_ROLES_UPDATED, SETTINGS_UPDATED -> 0xFEE75C;
            case SUBMISSION_DECIDED -> 0xEB459E;
        };
    }
}