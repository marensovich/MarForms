package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Entity representing a single audit log entry.
 * <p>
 * Stores information about system actions performed by users,
 * including who performed the action, what was affected,
 * and additional context about the change.
 * </p>
 * <p>
 * Used for security monitoring, compliance, and troubleshooting.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "audit_log", indexes = {
        @Index(name = "idx_audit_log_action", columnList = "action"),
        @Index(name = "idx_audit_log_created_at", columnList = "created_at"),
        @Index(name = "idx_audit_log_actor", columnList = "actor_discord_id")
})
public class AuditLog {

    /**
     * Unique identifier for the audit log entry.
     * Automatically generated as a UUID.
     *
     * @since v.0.1
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * The type of action that was performed.
     * <p>
     * Stored as a string using the {@link AuditAction} enum.
     * </p>
     *
     * @see AuditAction
     * @since v.0.1
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private AuditAction action;

    /**
     * Discord ID of the user who triggered this action.
     * <p>
     * May be {@code null} for system-generated actions.
     * </p>
     *
     * @since v.0.1
     */
    @Column(name = "actor_discord_id")
    private Long actorDiscordId;

    /**
     * Username snapshot at the time of the action.
     * <p>
     * Stored as a snapshot to preserve identity even if the user
     * changes their Discord username later.
     * </p>
     *
     * @since v.0.1
     */
    @Column(name = "actor_username")
    private String actorUsername;

    /**
     * Identifier of the entity that was affected.
     * <p>
     * Can be a UUID (form, role, submission), Discord ID (user),
     * or any other identifier string.
     * </p>
     *
     * @since v.0.1
     */
    @Column(name = "target_id")
    private String targetId;

    /**
     * Human-readable name of the affected entity.
     * <p>
     * Examples: form title, username, role name, etc.
     * </p>
     *
     * @since v.0.1
     */
    @Column(name = "target_name")
    private String targetName;

    /**
     * Extra details specific to the action.
     * <p>
     * Can contain:
     * <ul>
     *     <li>JSON for structured data (e.g., diff of changes)</li>
     *     <li>Plain text for simple messages</li>
     *     <li>Ban details (duration, reason)</li>
     *     <li>Role assignment changes</li>
     * </ul>
     * </p>
     *
     * @since v.0.1
     */
    @Column(columnDefinition = "TEXT")
    private String details;

    /**
     * The guild the action happened on, for moderator actions an owner
     * reviews (E2.5); {@code null} for platform-level entries.
     *
     * @since v.0.1
     */
    @Column(name = "guild_id")
    private Long guildId;

    /**
     * What {@link #targetId} refers to: {@code SUBMISSION}, {@code USER}, ...
     *
     * @since v.0.1
     */
    @Column(name = "target_type", length = 30)
    private String targetType;

    /**
     * Structured details (e.g. old and new status, comment, reason).
     *
     * @since v.0.1
     */
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> metadata;

    /**
     * The timestamp when the action was performed.
     * Automatically set to the current time and immutable.
     *
     * @since v.0.1
     */
    @Column(name = "created_at", nullable = false, updatable = false)
    // Microseconds, as the database keeps them: the journal's feed cursor compares this value (#129).
    private LocalDateTime createdAt = LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
}