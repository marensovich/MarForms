package me.marensovich.gta5rpformapp.backend.dto.guild;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;

import java.time.LocalDateTime;

/**
 * A member of a server's team, as the «Модераторы» tab lists it (ТЗ 4.7.1).
 *
 * @param discordId   the member's Discord ID (serialized as a string — snowflakes overflow JS numbers)
 * @param username    the member's Discord username
 * @param avatarUrl   their Discord avatar, {@code null} for the default one
 * @param role        {@code OWNER} or {@code MODERATOR}
 * @param since       when they became a moderator (or joined the team, for older rows)
 * @param addedById   who made them a moderator, {@code null} if unknown or an owner
 * @param addedByName that person's username
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record ModeratorDto(
        @JsonSerialize(using = ToStringSerializer.class)
        Long discordId,
        String username,
        String avatarUrl,
        GuildRole role,
        LocalDateTime since,
        @JsonSerialize(using = ToStringSerializer.class)
        Long addedById,
        String addedByName
) {
    public static ModeratorDto from(GuildMembership membership) {
        return from(membership, null);
    }

    public static ModeratorDto from(GuildMembership membership, String addedByName) {
        var user = membership.getUser();
        return new ModeratorDto(
                user.getDiscordId(),
                user.getDiscordUsername(),
                user.getDiscordAvatar() == null ? null
                        : "https://cdn.discordapp.com/avatars/" + user.getDiscordId() + "/" + user.getDiscordAvatar() + ".png?size=64",
                membership.getRole(),
                membership.getModeratorAddedAt() != null ? membership.getModeratorAddedAt() : membership.getCreatedAt(),
                membership.getModeratorAddedBy(),
                addedByName);
    }
}
