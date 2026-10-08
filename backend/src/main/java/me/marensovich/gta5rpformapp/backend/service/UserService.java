package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.user.AssignRolesRequest;
import me.marensovich.gta5rpformapp.backend.dto.user.BanUserRequest;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordApiClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordTokenService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Service for managing users.
 * <p>
 * Provides business logic for user creation, retrieval, role assignment,
 * guild synchronization, and ban management.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleService roleService;
    static final Duration GUILD_RESYNC_THROTTLE = Duration.ofMinutes(1);

    private final DiscordApiClient discordApiClient;
    private final DiscordTokenService discordTokenService;
    private final AuditLogService auditLogService;

    /**
     * Finds an existing user by Discord ID or creates a new one if not found.
     *
     * @param discordId the Discord ID of the user
     * @param username  the Discord username of the user
     * @return the existing or newly created {@link User} entity
     * @since v.0.1
     */
    public User findOrCreateDiscordUser(Long discordId, String username) {
        return userRepository.findByDiscordId(discordId)
                .orElseGet(() -> {
                    User user = new User();
                    user.setDiscordId(discordId);
                    user.setDiscordUsername(username);
                    user.setRoles(Set.of());
                    return userRepository.save(user);
                });
    }

    /**
     * Retrieves a paginated list of all users with optional search and role filters.
     * <p>
     * Supports filtering by:
     * <ul>
     *     <li><b>Search</b> — matches against {@code discordUsername} (case-insensitive, partial match)
     *     or {@code discordId} (partial match)</li>
     *     <li><b>Role ID</b> — filters users who have a specific role assigned</li>
     * </ul>
     * The search string is normalized by trimming whitespace. Empty or blank search strings
     * are treated as {@code null} (no search filter).
     * </p>
     *
     * @param search   optional search string for username or Discord ID (case-insensitive)
     * @param roleId   optional role UUID to filter users by role
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link User} entities matching the filters
     * @since v.0.1
     */
    public Page<User> listAll(String search, UUID roleId, Pageable pageable) {
        String normalizedSearch = (search != null && !search.isBlank()) ? search.trim() : null;
        return userRepository.findAllWithFilters(normalizedSearch, roleId, pageable);
    }

    /**
     * Synchronizes the user's Discord guild memberships.
     * <p>
     * Fetches the list of guilds the user is a member of from Discord's API
     * and updates the user's {@code guildIds} set.
     * </p>
     *
     * @param user               the user to sync guilds for
     * @param discordAccessToken the user's Discord OAuth2 access token
     * @return the updated {@link User} entity
     * @since v.0.1
     */
    @Transactional
    public User syncGuilds(User user, String discordAccessToken) {
        Set<Long> guildIds = discordApiClient.fetchUserGuildIds(discordAccessToken);
        user.setGuildIds(guildIds);
        user.setGuildsSyncedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    /**
     * Re-syncs the user's guild list using their stored (and, if needed,
     * auto-refreshed) Discord token — no re-login required.
     * <p>
     * Used when a form access check fails: the user may have joined the
     * server after logging in. Throttled to once per
     * {@link #GUILD_RESYNC_THROTTLE} so repeated checks don't hammer Discord.
     * </p>
     *
     * @param user the user to re-sync
     * @return {@code true} if a re-sync actually happened
     * @since v.0.1
     */
    @Transactional
    public boolean resyncGuildsWithStoredToken(User user) {
        if (user.getGuildsSyncedAt() != null
                && user.getGuildsSyncedAt().isAfter(LocalDateTime.now().minus(GUILD_RESYNC_THROTTLE))) {
            return false;
        }
        return discordTokenService.getValidAccessToken(user.getId())
                .map(token -> {
                    syncGuilds(user, token);
                    return true;
                })
                .orElse(false);
    }

    /**
     * Retrieves a user by their Discord ID.
     *
     * @param discordId the Discord ID of the user to retrieve
     * @return the {@link User} entity
     * @throws NotFoundException if the user does not exist
     * @since v.0.1
     */
    public User getByDiscordId(Long discordId) {
        return userRepository.findByDiscordId(discordId)
                .orElseThrow(() -> new NotFoundException("User not found: " + discordId));
    }

    /**
     * Assigns roles to a user.
     * <p>
     * Replaces the user's current roles with the specified set.
     * </p>
     *
     * @param discordId the Discord ID of the user to update
     * @param request   the {@link AssignRolesRequest} containing the role IDs to assign
     * @return the updated {@link User} entity
     * @throws NotFoundException if the user or any of the roles do not exist
     * @since v.0.1
     */
    @Transactional
    public User assignRoles(Long discordId, AssignRolesRequest request) {
        User user = getByDiscordId(discordId);

        Set<Role> roles = new HashSet<>();
        for (var roleId : request.roleIds()) {
            roles.add(roleService.getById(roleId));
        }

        String oldRoleNames = user.getRoles().stream()
                .map(Role::getName)
                .sorted()
                .collect(java.util.stream.Collectors.joining(", "));
        user.setRoles(roles);
        User saved = userRepository.save(user);
        String newRoleNames = roles.stream()
                .map(Role::getName)
                .sorted()
                .collect(java.util.stream.Collectors.joining(", "));
        String details = "Roles: [" + (oldRoleNames.isBlank() ? "none" : oldRoleNames)
                + "] → [" + (newRoleNames.isBlank() ? "none" : newRoleNames) + "]";
        auditLogService.logByCurrentUser(AuditAction.USER_ROLES_UPDATED,
                String.valueOf(discordId), saved.getDiscordUsername(), details);
        return saved;
    }

    /**
     * Bans a user.
     * <p>
     * Supports both permanent and temporary bans. For temporary bans,
     * a positive timeout duration must be provided.
     * </p>
     *
     * @param discordId the Discord ID of the user to ban
     * @param request   the {@link BanUserRequest} containing ban configuration
     * @return the updated {@link User} entity
     * @throws NotFoundException        if the user does not exist
     * @throws IllegalArgumentException if a temporary ban is requested without a positive timeout
     * @since v.0.1
     */
    @Transactional
    public User ban(Long discordId, BanUserRequest request) {
        User user = getByDiscordId(discordId);

        if (request.permanent()) {
            user.setBannedPermanently(true);
            user.setBannedUntil(null);
        } else {
            if (request.timeoutMinutes() == null || request.timeoutMinutes() <= 0) {
                throw new IllegalArgumentException("timeoutMinutes must be a positive number for a temporary ban");
            }
            user.setBannedUntil(LocalDateTime.now().plusMinutes(request.timeoutMinutes()));
        }

        User saved = userRepository.save(user);
        String details = request.permanent()
                ? "Banned permanently"
                : "Banned for " + request.timeoutMinutes() + " minutes";
        auditLogService.logByCurrentUser(AuditAction.USER_BANNED,
                String.valueOf(discordId), saved.getDiscordUsername(), details);
        return saved;
    }

    /**
     * Unbans a user.
     * <p>
     * Removes both permanent and temporary ban status from the user.
     * </p>
     *
     * @param discordId the Discord ID of the user to unban
     * @return the updated {@link User} entity
     * @throws NotFoundException if the user does not exist
     * @since v.0.1
     */
    @Transactional
    public User unban(Long discordId) {
        User user = getByDiscordId(discordId);
        String prevBan = user.isBannedPermanently()
                ? "was permanently banned"
                : user.getBannedUntil() != null
                  ? "was temporarily banned until " + user.getBannedUntil()
                  : "was banned";
        user.setBannedPermanently(false);
        user.setBannedUntil(null);
        User saved = userRepository.save(user);
        auditLogService.logByCurrentUser(AuditAction.USER_UNBANNED,
                String.valueOf(discordId), saved.getDiscordUsername(), prevBan);
        return saved;
    }
}