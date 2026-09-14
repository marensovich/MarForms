package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
}
