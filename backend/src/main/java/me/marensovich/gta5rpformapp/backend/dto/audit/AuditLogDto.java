package me.marensovich.gta5rpformapp.backend.dto.audit;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditDiff;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import me.marensovich.gta5rpformapp.backend.database.entity.User;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * An entry of the platform journal (ТЗ 6.5).
 *
 * @param id             the entry's ID
 * @param action         what happened
 * @param actorDiscordId who did it, {@code null} for the system
 * @param actorUsername  their name then
 * @param actorAvatarUrl their Discord avatar, {@code null} for the default
 * @param targetId       what it was done to
 * @param targetName     its readable name
 * @param targetType     its kind ({@code FORM}, {@code USER}, …), if known
 * @param guildId        the server it happened on, if any
 * @param details        the human-readable details
 * @param diff           the fields that changed, before and after (secrets masked)
 * @param createdAt      when
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
        String actorAvatarUrl,
        String targetId,
        String targetName,
        String targetType,
        @JsonSerialize(using = ToStringSerializer.class)
        Long guildId,
        String details,
        List<Map<String, Object>> diff,
        LocalDateTime createdAt,
        /** The last of merged back-to-back edits, {@code null} for one (2026-10-19). */
        LocalDateTime lastAt
) {
    public static AuditLogDto from(AuditLog log) {
        return from(log, null);
    }

    /**
     * Converts an entry, with the actor's avatar.
     *
     * @param log            the entry
     * @param actorAvatarUrl the actor's avatar, may be {@code null}
     * @return the DTO
     * @since v.0.1
     */
    @SuppressWarnings("unchecked")
    public static AuditLogDto from(AuditLog log, String actorAvatarUrl) {
        Object diff = log.getMetadata() == null ? null : log.getMetadata().get(AuditDiff.KEY);
        return new AuditLogDto(
                log.getId(),
                log.getAction(),
                log.getActorDiscordId(),
                log.getActorUsername(),
                actorAvatarUrl,
                log.getTargetId(),
                log.getTargetName(),
                log.getTargetType(),
                log.getGuildId(),
                AuditDiff.mask(log.getDetails()),
                diff instanceof List<?> list ? (List<Map<String, Object>>) list : List.of(),
                log.getCreatedAt(),
                log.getLastAt()
        );
    }

    /** A user's Discord avatar URL, {@code null} for the default one. */
    public static String avatarUrl(User user) {
        return user.getDiscordAvatar() == null ? null
                : "https://cdn.discordapp.com/avatars/" + user.getDiscordId() + "/" + user.getDiscordAvatar() + ".png?size=64";
    }
}
