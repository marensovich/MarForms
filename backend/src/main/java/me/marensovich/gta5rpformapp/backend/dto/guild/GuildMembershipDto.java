package me.marensovich.gta5rpformapp.backend.dto.guild;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Data Transfer Object representing one of the current user's per-guild memberships.
 *
 * @param guildId   the Discord guild snowflake ID
 * @param guildName the guild's display name (a placeholder until the bot module can
 *                  fetch real Discord metadata — see {@code GuildService})
 * @param botStatus whether the bot is still installed on this guild
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
        GuildBotStatus botStatus,
        GuildRole role,
        LocalDateTime since,
        /* «Мои серверы» (#124): */
        String guildIconUrl,
        Integer memberCount,
        /** CONNECTED, MISSING_PERMISSIONS or KICKED. */
        String botState,
        List<String> missingPermissions,
        long activeForms,
        long pendingSubmissions
) {
    /**
     * The card of «Мои серверы» (#124): the server, the bot's state and the counters.
     *
     * @param membership         the user's membership
     * @param activeForms        published forms of the server
     * @param pendingSubmissions submissions waiting for a decision
     * @return the DTO
     * @since v.0.1
     */
    public static GuildMembershipDto from(GuildMembership membership, long activeForms, long pendingSubmissions) {
        var guild = membership.getGuild();
        List<String> missing = guild.missingPermissionList();
        String state = guild.getBotStatus() == GuildBotStatus.KICKED ? "KICKED"
                : missing.isEmpty() ? "CONNECTED" : "MISSING_PERMISSIONS";
        return new GuildMembershipDto(guild.getDiscordGuildId(), guild.getName(), guild.getBotStatus(),
                membership.getRole(), membership.getCreatedAt(), guild.iconUrl(), guild.getMemberCount(), state,
                missing, activeForms, pendingSubmissions);
    }

    /**
     * Builds a {@link GuildMembershipDto} from a {@link GuildMembership} entity.
     *
     * @param membership the entity to convert
     * @return the corresponding DTO
     * @since v.0.1
     */
    public static GuildMembershipDto from(GuildMembership membership) {
        return from(membership, 0, 0);
    }
}
