package me.marensovich.gta5rpformapp.backend.dto.audit;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * One entry of a guild's audit log, as its owner sees it (E2.5).
 *
 * @param id             the entry's ID
 * @param action         what happened
 * @param actorDiscordId who did it (serialized as string)
 * @param actorUsername  their username at the time
 * @param targetType     what the target is ({@code SUBMISSION}, {@code USER})
 * @param targetId       the target's ID
 * @param targetName     a readable name for the target
 * @param metadata       structured details
 * @param createdAt      when it happened
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record GuildAuditEntryDto(
        UUID id,
        AuditAction action,
        @JsonSerialize(using = ToStringSerializer.class)
        Long actorDiscordId,
        String actorUsername,
        String targetType,
        String targetId,
        String targetName,
        Map<String, Object> metadata,
        LocalDateTime createdAt
) {
    public static GuildAuditEntryDto from(AuditLog log) {
        return new GuildAuditEntryDto(log.getId(), log.getAction(), log.getActorDiscordId(), log.getActorUsername(),
                log.getTargetType(), log.getTargetId(), log.getTargetName(), log.getMetadata(), log.getCreatedAt());
    }
}
