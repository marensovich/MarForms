package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Service for managing {@link GuildMembership} entities.
 * <p>
 * Membership rows are created lazily as users interact with a guild's forms —
 * there is no separate "connect your server" step yet (see {@link GuildService}).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class GuildMembershipService {

    private final GuildMembershipRepository guildMembershipRepository;
    private final GuildService guildService;
    private final UserRepository userRepository;
    private final DiscordBotClient discordBotClient;

    /**
     * How long cached Discord roles are trusted before being re-fetched.
     */
    @Value("${app.discord.member-roles-ttl:PT5M}")
    private Duration memberRolesTtl = Duration.ofMinutes(5);

    /**
     * Ensures a user holds at least the given role on a guild.
     * <p>
     * Creates the membership (and the {@link Guild} row, if needed) when none
     * exists yet. When a membership already exists, its role is only ever
     * upgraded (e.g. RESPONDENT → OWNER) — an existing OWNER or MODERATOR is
     * never downgraded by a lower-privilege call.
     * </p>
     *
     * @param userDiscordId  the Discord ID of the user
     * @param guildDiscordId the Discord guild snowflake ID
     * @param minimumRole    the role the user should hold at minimum
     * @return the (possibly just-created or just-upgraded) {@link GuildMembership}
     * @throws NotFoundException if no user exists for {@code userDiscordId}
     * @since v.0.1
     */
    @Transactional
    public GuildMembership ensureMembership(Long userDiscordId, Long guildDiscordId, GuildRole minimumRole) {
        User user = userRepository.findByDiscordId(userDiscordId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userDiscordId));
        Guild guild = guildService.getOrCreate(guildDiscordId);

        GuildMembership membership = guildMembershipRepository
                .findByUser_IdAndGuild_DiscordGuildId(user.getId(), guildDiscordId)
                .orElse(null);

        if (membership == null) {
            membership = new GuildMembership();
            membership.setUser(user);
            membership.setGuild(guild);
            membership.setRole(minimumRole);
            return guildMembershipRepository.save(membership);
        }

        if (minimumRole.ordinal() < membership.getRole().ordinal()) {
            membership.setRole(minimumRole);
            return guildMembershipRepository.save(membership);
        }

        return membership;
    }

    /**
     * Refreshes a member's cached Discord roles ({@link GuildMembership#getDiscordRoles()})
     * via the bot, if the cache is older than {@code app.discord.member-roles-ttl}
     * (product spec раздел 4.3: for MVP, check on every visit with a TTL cache,
     * no Gateway subscription).
     * <p>
     * If the bot can't answer (not configured, not in the guild, Discord
     * error), the existing cache is left as-is rather than wiped — a stale
     * role list is better than none for a later RoleGate check.
     * </p>
     *
     * @param userDiscordId  the Discord ID of the member
     * @param guildDiscordId the Discord guild snowflake ID
     * @return the membership (possibly with refreshed roles), or empty if
     * there is no membership row for this user/guild
     * @since v.0.1
     */
    @Transactional
    public Optional<GuildMembership> syncDiscordRolesIfStale(Long userDiscordId, Long guildDiscordId) {
        return guildMembershipRepository
                .findByUser_DiscordIdAndGuild_DiscordGuildId(userDiscordId, guildDiscordId)
                .map(membership -> {
                    LocalDateTime syncedAt = membership.getDiscordRolesSyncedAt();
                    if (syncedAt != null && syncedAt.isAfter(LocalDateTime.now().minus(memberRolesTtl))) {
                        return membership;
                    }
                    return discordBotClient.fetchMemberRoleIds(guildDiscordId, userDiscordId)
                            .map(roles -> {
                                membership.setDiscordRoles(roles);
                                membership.setDiscordRolesSyncedAt(LocalDateTime.now());
                                return guildMembershipRepository.save(membership);
                            })
                            .orElse(membership);
                });
    }
}
