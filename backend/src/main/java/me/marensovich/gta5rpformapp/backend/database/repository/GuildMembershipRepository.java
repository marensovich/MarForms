package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for accessing {@link GuildMembership} entities in the database.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface GuildMembershipRepository extends JpaRepository<GuildMembership, UUID> {

    /**
     * Retrieves a user's membership row for a specific guild, if any.
     *
     * @param userId  the user's internal ID
     * @param guildId the Discord guild snowflake ID
     * @return an {@link Optional} containing the membership, or empty if the
     * user has no recorded relationship with that guild
     * @since v.0.1
     */
    Optional<GuildMembership> findByUser_IdAndGuild_DiscordGuildId(Long userId, Long guildId);

    /**
     * Same as {@link #findByUser_IdAndGuild_DiscordGuildId}, but keyed by the
     * user's Discord ID instead of the internal one.
     *
     * @param discordId the user's Discord snowflake ID
     * @param guildId   the Discord guild snowflake ID
     * @return an {@link Optional} containing the membership, if any
     * @since v.0.1
     */
    Optional<GuildMembership> findByUser_DiscordIdAndGuild_DiscordGuildId(Long discordId, Long guildId);

    /**
     * Retrieves all of a user's memberships across every guild.
     *
     * @param userId the user's internal ID
     * @return a {@link List} of the user's {@link GuildMembership} rows
     * @since v.0.1
     */
    List<GuildMembership> findAllByUser_Id(Long userId);

    /**
     * Retrieves every member of a guild holding a specific role — for
     * example, listing a guild's moderators.
     *
     * @param guildId the Discord guild snowflake ID
     * @param role    the role to filter by
     * @return a {@link List} of matching {@link GuildMembership} rows
     * @since v.0.1
     */
    List<GuildMembership> findAllByGuild_DiscordGuildIdAndRole(Long guildId, GuildRole role);

    long countByGuild_DiscordGuildIdAndRole(Long guildId, GuildRole role);
}
