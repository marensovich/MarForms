package me.marensovich.gta5rpformapp.backend.dto.guild;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;

import java.time.LocalDateTime;

/**
 * Data Transfer Object representing one of the current user's per-guild memberships.
 *
 * @param guildId   the Discord guild snowflake ID
 * @param guildName the guild's display name (a placeholder until the bot module can
 *                  fetch real Discord metadata — see {@code GuildService})
 * @param role      the user's role on this guild
 * @param since     when this membership was first recorded
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record GuildMembershipDto(
        @JsonSerialize(using = ToStringSerializer.class)
        Long guildId,
        String guildName,
        GuildRole role,
        LocalDateTime since
) {
    /**
     * Builds a {@link GuildMembershipDto} from a {@link GuildMembership} entity.
     *
     * @param membership the entity to convert
     * @return the corresponding DTO
     * @since v.0.1
     */
    public static GuildMembershipDto from(GuildMembership membership) {
        return new GuildMembershipDto(
                membership.getGuild().getDiscordGuildId(),
                membership.getGuild().getName(),
                membership.getRole(),
                membership.getCreatedAt()
        );
    }
}
