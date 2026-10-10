package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.billing.PlanLimitService;
import me.marensovich.gta5rpformapp.backend.service.billing.PlanMetric;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import me.marensovich.gta5rpformapp.backend.dto.guild.AddModeratorRequest;
import me.marensovich.gta5rpformapp.backend.dto.guild.ModeratorDto;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
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
    private final AuditLogService auditLogService;
    private final PlanLimitService planLimitService;
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
     * Lists a guild's moderators.
     *
     * @param guildDiscordId the Discord guild snowflake ID
     * @return the moderators, oldest first
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public List<ModeratorDto> listModerators(Long guildDiscordId) {
        return guildMembershipRepository.findAllByGuild_DiscordGuildIdAndRole(guildDiscordId, GuildRole.MODERATOR)
                .stream()
                .map(ModeratorDto::from)
                .sorted(Comparator.comparing(ModeratorDto::since))
                .toList();
    }

    /**
     * Makes an existing user a moderator of a guild (task #60).
     * <p>
     * Behaviour on edge cases:
     * <ul>
     *     <li>The user must already exist (have logged in once) — otherwise 404.</li>
     *     <li><b>The target is this guild's OWNER</b> — rejected with 400.
     *     An owner already has every moderator right, and silently demoting
     *     them to MODERATOR would lock them out of owner-only actions.</li>
     *     <li>The target is already a moderator — no-op, returns them as-is.</li>
     *     <li>The target is a RESPONDENT (or has no membership yet) — promoted.</li>
     * </ul>
     * </p>
     *
     * @param guildDiscordId the Discord guild snowflake ID
     * @param request        identifies the user by Discord ID or username
     * @return the new (or existing) moderator
     * @throws NotFoundException        if no such user exists
     * @throws IllegalArgumentException if the user is the guild's owner, or
     *                                  the request is empty/ambiguous
     * @since v.0.1
     */
    @Transactional
    public ModeratorDto addModerator(Long guildDiscordId, AddModeratorRequest request) {
        User user = resolveUser(request);
        Guild guild = guildService.getOrCreate(guildDiscordId);

        GuildMembership membership = guildMembershipRepository
                .findByUser_IdAndGuild_DiscordGuildId(user.getId(), guildDiscordId)
                .orElse(null);

        if (membership != null && membership.getRole() == GuildRole.OWNER) {
            throw new IllegalArgumentException("This user is the server owner and already has full access");
        }
        if (membership == null) {
            membership = new GuildMembership();
            membership.setUser(user);
            membership.setGuild(guild);
        }
        if (membership.getRole() != GuildRole.MODERATOR) {
            planLimitService.requireRoomFor(guildDiscordId, PlanMetric.MODERATORS);
            membership.setRole(GuildRole.MODERATOR);
            membership = guildMembershipRepository.save(membership);
            auditLogService.logGuildAction(guildDiscordId, AuditAction.MODERATOR_ADDED, "USER",
                    user.getDiscordId().toString(), user.getDiscordUsername(), null, null);
        }
        return ModeratorDto.from(membership);
    }

    /**
     * Removes the moderator role from a user — they go back to being a
     * plain RESPONDENT of the guild (the membership row is kept).
     *
     * @param guildDiscordId the Discord guild snowflake ID
     * @param userDiscordId  the moderator's Discord ID
     * @throws NotFoundException if the user isn't a moderator of this guild
     * @since v.0.1
     */
    @Transactional
    public void removeModerator(Long guildDiscordId, Long userDiscordId) {
        GuildMembership membership = guildMembershipRepository
                .findByUser_DiscordIdAndGuild_DiscordGuildId(userDiscordId, guildDiscordId)
                .filter(m -> m.getRole() == GuildRole.MODERATOR)
                .orElseThrow(() -> new NotFoundException("User " + userDiscordId + " is not a moderator of this server"));
        membership.setRole(GuildRole.RESPONDENT);
        guildMembershipRepository.save(membership);
        auditLogService.logGuildAction(guildDiscordId, AuditAction.MODERATOR_REMOVED, "USER",
                userDiscordId.toString(), membership.getUser().getDiscordUsername(), null, null);
    }

    private User resolveUser(AddModeratorRequest request) {
        if (request == null) throw new IllegalArgumentException("Specify a Discord ID or username");
        if (request.discordId() != null && !request.discordId().isBlank()) {
            long discordId;
            try {
                discordId = Long.parseUnsignedLong(request.discordId().trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid Discord ID: " + request.discordId());
            }
            return userRepository.findByDiscordId(discordId)
                    .orElseThrow(() -> new NotFoundException(
                            "No user with Discord ID " + discordId + " — they need to log in to MarForms once first"));
        }
        if (request.username() != null && !request.username().isBlank()) {
            String username = request.username().trim();
            List<User> matches = userRepository.findAllByDiscordUsernameContainingIgnoreCase(username).stream()
                    .filter(u -> u.getDiscordUsername().equalsIgnoreCase(username))
                    .toList();
            if (matches.isEmpty()) {
                throw new NotFoundException(
                        "No user named " + username + " — they need to log in to MarForms once first");
            }
            if (matches.size() > 1) {
                throw new IllegalArgumentException("Several users are named " + username + " — use the Discord ID");
            }
            return matches.getFirst();
        }
        throw new IllegalArgumentException("Specify a Discord ID or username");
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
