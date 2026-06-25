package me.marensovich.gta5rpformapp.backend.dto.audit;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Data Transfer Object for an audit log entry.
 * <p>
 * Contains all information about an auditable system action, including
 * who performed it, what was affected, and when it occurred.
 * Used for displaying audit logs in the admin interface.
 * </p>
 *
 * @param id             the unique identifier of the audit log entry
 * @param action         the type of action that was performed
 * @param actorDiscordId the Discord ID of the user who performed the action (serialized as string)
 * @param actorUsername  the username of the actor at the time of the action
 * @param targetId       the identifier of the affected entity
 * @param targetName     the human-readable name of the affected entity
 * @param details        additional context or details about the action
 * @param createdAt      the timestamp when the action was performed
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record AuditLogDto(
        UUID id,
        AuditAction action,
        @JsonSerialize(using = ToStringSerializer.class)
        Long actorDiscordId,
        String actorUsername,
        String targetId,
        String targetName,
        String details,
        LocalDateTime createdAt
) {
    /**
     * Converts an {@link AuditLog} entity to an {@link AuditLogDto}.
     *
     * @param log the audit log entity to convert
     * @return a new {@link AuditLogDto} containing the audit log data
     * @since v.0.1
     */
    public static AuditLogDto from(AuditLog log) {
        return new AuditLogDto(
                log.getId(),
                log.getAction(),
                log.getActorDiscordId(),
                log.getActorUsername(),
                log.getTargetId(),
                log.getTargetName(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }
}