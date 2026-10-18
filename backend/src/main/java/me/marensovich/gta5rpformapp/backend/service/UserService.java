package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import me.marensovich.gta5rpformapp.backend.database.entity.UserRestriction;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRestrictionRepository;
import me.marensovich.gta5rpformapp.backend.dto.user.TimeoutRequest;
import me.marensovich.gta5rpformapp.backend.exception.HierarchyException;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.security.core.context.SecurityContextHolder;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditDiff;
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
    private final UserRestrictionRepository restrictionRepository;

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
     * Updates the user's Discord username and avatar hash from fresh OAuth
     * data, saving only if something changed.
     *
     * @param user     the user
     * @param username their current Discord username (ignored if blank)
     * @param avatar   their current avatar hash, {@code null} for the default avatar
     * @since v.0.1
     */
    public void refreshProfile(User user, String username, String avatar) {
        boolean changed = false;
        if (username != null && !username.isBlank() && !username.equals(user.getDiscordUsername())) {
            user.setDiscordUsername(username);
            changed = true;
        }
        if (!java.util.Objects.equals(avatar, user.getDiscordAvatar())) {
            user.setDiscordAvatar(avatar);
            changed = true;
        }
        if (changed) userRepository.save(user);
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
        // A failed call (429, outage) keeps the old list and doesn't count as a
        // sync, so the next request tries again instead of a minute of "you're
        // not on this server" (#103).
        Set<Long> guildIds = discordApiClient.fetchUserGuildIds(discordAccessToken).orElse(null);
        if (guildIds == null) return user;
        user.setGuildIds(guildIds);
        // Write onto a freshly read row, not the copy loaded at the start of the
        // request: saving that would undo a ban or logout made meanwhile (#103).
        User fresh = userRepository.findById(user.getId()).orElse(user);
        fresh.setGuildIds(guildIds);
        fresh.setGuildsSyncedAt(LocalDateTime.now());
        return userRepository.save(fresh);
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
     * Replaces a user's platform roles (ТЗ 6.3 «Назначить роли»).
     * <p>
     * Hierarchy (ТЗ 2.3): roles can't be taken from a user of a higher platform
     * role; only a system administrator grants or takes a role with
     * {@code SYSTEM_ADMIN}; and the last holder of {@code SYSTEM_ADMIN} keeps it.
     * </p>
     *
     * @param discordId the Discord ID of the user to update
     * @param request   the {@link AssignRolesRequest} containing the role IDs to assign
     * @return the updated {@link User} entity
     * @throws NotFoundException     if the user or any of the roles do not exist
     * @throws HierarchyException    if the hierarchy forbids it
     * @throws InvalidStateException if the last system administrator would lose the role
     * @since v.0.1
     */
    @Transactional
    public User assignRoles(Long discordId, AssignRolesRequest request) {
        User user = getByDiscordId(discordId);

        Set<Role> roles = new HashSet<>();
        for (var roleId : request.roleIds()) {
            roles.add(roleService.getById(roleId));
        }

        Set<Role> removed = new HashSet<>(user.getRoles());
        removed.removeAll(roles);
        Set<Role> added = new HashSet<>(roles);
        added.removeAll(user.getRoles());
        if (!removed.isEmpty() && !outranks(user)) {
            throw new HierarchyException("You can't take roles from a user with a higher platform role");
        }
        boolean touchesSystemAdmin = Stream.concat(removed.stream(), added.stream())
                .anyMatch(r -> r.getPermissions().contains(Permission.SYSTEM_ADMIN));
        if (touchesSystemAdmin && !currentUserHas(Permission.SYSTEM_ADMIN)) {
            throw new HierarchyException("Only a system administrator can grant or take the System Admin permission");
        }
        boolean losesSystemAdmin = rank(user.getRoles()) == 3 && rank(roles) < 3;
        if (losesSystemAdmin && userRepository.countWithPermission(Permission.SYSTEM_ADMIN) <= 1) {
            throw new InvalidStateException("The last system administrator keeps the System Admin role");
        }

        String oldRoleNames = user.getRoles().stream()
                .map(Role::getName)
                .sorted()
                .collect(Collectors.joining(", "));
        user.setRoles(roles);
        User saved = userRepository.save(user);
        String newRoleNames = roles.stream()
                .map(Role::getName)
                .sorted()
                .collect(Collectors.joining(", "));
        String details = "Roles: [" + (oldRoleNames.isBlank() ? "none" : oldRoleNames)
                + "] → [" + (newRoleNames.isBlank() ? "none" : newRoleNames) + "]";
        auditLogService.logByCurrentUser(AuditAction.USER_ROLES_UPDATED,
                String.valueOf(discordId), saved.getDiscordUsername(), details,
                new AuditDiff().add("roles", oldRoleNames.isBlank() ? List.of() : List.of(oldRoleNames.split(", ")),
                        roles.stream().map(Role::getName).toList()));
        return saved;
    }

    /**
     * Bans a user from the whole platform (ТЗ 6.3): no forms, no panel, on any
     * server, until unbanned. Their submissions stay. A time-out in force ends.
     *
     * @param discordId the user
     * @param request   the reason, which the user sees
     * @return the user
     * @throws HierarchyException if the user has a higher platform role
     * @since v.0.1
     */
    @Transactional
    public User ban(Long discordId, BanUserRequest request) {
        User user = getByDiscordId(discordId);
        requireMayRestrict(user);

        String reason = blankToNull(request.reason());
        liftOpen(user, UserRestriction.Type.TIMEOUT);
        user.setBannedPermanently(true);
        user.setBannedUntil(null);
        user.setRestrictionReason(reason);
        User saved = userRepository.save(user);
        record(saved, UserRestriction.Type.BAN, reason, null);
        auditLogService.logByCurrentUser(AuditAction.USER_BANNED, String.valueOf(discordId), saved.getDiscordUsername(),
                reason != null ? "Banned: " + reason : "Banned");
        return saved;
    }

    /**
     * Times a user out (ТЗ 6.3): for the given minutes they can't send
     * submissions or open the panel; they still see their own submissions.
     *
     * @param discordId the user
     * @param request   how long and why (the user sees it)
     * @return the user
     * @throws HierarchyException    if the user has a higher platform role
     * @throws InvalidStateException if the user is banned
     * @since v.0.1
     */
    @Transactional
    public User timeout(Long discordId, TimeoutRequest request) {
        User user = getByDiscordId(discordId);
        requireMayRestrict(user);
        if (user.isBanned()) throw new InvalidStateException("The user is banned; a time-out would change nothing");

        String reason = request.reason().trim();
        LocalDateTime until = LocalDateTime.now().plusMinutes(request.minutes());
        liftOpen(user, UserRestriction.Type.TIMEOUT);
        user.setBannedUntil(until);
        user.setRestrictionReason(reason);
        User saved = userRepository.save(user);
        record(saved, UserRestriction.Type.TIMEOUT, reason, until);
        auditLogService.logByCurrentUser(AuditAction.USER_TIMED_OUT, String.valueOf(discordId), saved.getDiscordUsername(),
                "Timed out for " + request.minutes() + " min until " + until.withNano(0) + ": " + reason);
        return saved;
    }

    /**
     * Ends a time-out early.
     *
     * @param discordId the user
     * @return the user
     * @throws InvalidStateException if the user isn't timed out
     * @since v.0.1
     */
    @Transactional
    public User liftTimeout(Long discordId) {
        User user = getByDiscordId(discordId);
        if (!user.isTimedOut()) throw new InvalidStateException("The user isn't timed out");
        requireMayRestrict(user);
        liftOpen(user, UserRestriction.Type.TIMEOUT);
        user.setBannedUntil(null);
        user.setRestrictionReason(null);
        User saved = userRepository.save(user);
        auditLogService.logByCurrentUser(AuditAction.USER_TIMEOUT_LIFTED, String.valueOf(discordId), saved.getDiscordUsername(),
                "Time-out lifted");
        return saved;
    }

    /**
     * Lifts a ban (and a time-out); access comes back at once.
     *
     * @param discordId the user
     * @return the user
     * @since v.0.1
     */
    @Transactional
    public User unban(Long discordId) {
        User user = getByDiscordId(discordId);
        String prevBan = user.isBannedPermanently()
                ? "was banned" + (user.getRestrictionReason() != null ? ": " + user.getRestrictionReason() : "")
                : user.getBannedUntil() != null
                  ? "was timed out until " + user.getBannedUntil()
                  : "wasn't restricted";
        liftOpen(user, UserRestriction.Type.BAN);
        liftOpen(user, UserRestriction.Type.TIMEOUT);
        user.setBannedPermanently(false);
        user.setBannedUntil(null);
        user.setRestrictionReason(null);
        User saved = userRepository.save(user);
        auditLogService.logByCurrentUser(AuditAction.USER_UNBANNED,
                String.valueOf(discordId), saved.getDiscordUsername(), prevBan);
        return saved;
    }

    /** A user's bans and time-outs, the latest first (the «Разбан» dialog shows them). */
    public List<UserRestriction> restrictions(Long discordId) {
        return restrictionRepository.findAllByUserDiscordIdOrderByCreatedAtDesc(discordId);
    }

    /**
     * The platform's users (ТЗ 6.3), filtered on the server.
     *
     * @param q        part of the username, or the Discord ID
     * @param roleId   one platform role, or any
     * @param status   {@code active}, {@code timeout}, {@code banned}, or any
     * @param pageable the page
     * @return the page
     * @since v.0.1
     */
    public Page<User> search(String q, UUID roleId, String status, Pageable pageable) {
        return userRepository.findAll((root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String text = q.trim();
                String like = "%" + text.toLowerCase(Locale.ROOT).replace("%", "\\%").replace("_", "\\_") + "%";
                Predicate byName = cb.like(cb.lower(root.get("discordUsername")), like, '\\');
                p.add(text.matches("\\d{1,19}") ? cb.or(byName, cb.equal(root.get("discordId"), Long.parseLong(text))) : byName);
            }
            if (roleId != null) {
                Subquery<Long> sub = query.subquery(Long.class);
                Root<User> u = sub.from(User.class);
                sub.select(u.get("id")).where(cb.equal(u.join("roles").get("id"), roleId));
                p.add(root.get("id").in(sub));
            }
            LocalDateTime now = LocalDateTime.now();
            Predicate banned = cb.isTrue(root.get("bannedPermanently"));
            Predicate timedOut = cb.and(cb.not(banned), cb.greaterThan(root.get("bannedUntil"), now));
            switch (status == null ? "" : status) {
                case "banned" -> p.add(banned);
                case "timeout" -> p.add(timedOut);
                case "active" -> p.add(cb.and(cb.not(banned), cb.or(cb.isNull(root.get("bannedUntil")),
                        cb.lessThanOrEqualTo(root.get("bannedUntil"), now))));
                default -> {
                }
            }
            return cb.and(p.toArray(Predicate[]::new));
        }, pageable);
    }

    /** The KPIs of ТЗ 6.3: all users and new ones this week, active in 30 days, bans and time-outs. */
    public Map<String, Long> stats() {
        LocalDateTime now = LocalDateTime.now();
        return Map.of(
                "total", userRepository.count(),
                "lastWeek", userRepository.count((r, q, cb) -> cb.greaterThanOrEqualTo(r.get("createdAt"), now.minusDays(7))),
                "active30", userRepository.count((r, q, cb) -> cb.greaterThanOrEqualTo(r.get("lastSeenAt"), now.minusDays(30))),
                "banned", userRepository.count((r, q, cb) -> cb.isTrue(r.get("bannedPermanently"))),
                "timedOut", userRepository.count((r, q, cb) -> cb.and(cb.isFalse(r.get("bannedPermanently")),
                        cb.greaterThan(r.get("bannedUntil"), now))));
    }

    /**
     * A user's platform level (ТЗ 2.3): 3 system administrator, 2 administrator
     * (manages roles), 1 any other right, 0 none.
     *
     * @param roles the user's roles
     * @return the level
     * @since v.0.1
     */
    public static int rank(Set<Role> roles) {
        Set<Permission> p = roles.stream().flatMap(r -> r.getPermissions().stream()).collect(Collectors.toSet());
        if (p.contains(Permission.SYSTEM_ADMIN)) return 3;
        if (p.contains(Permission.ROLES_MANAGE)) return 2;
        return p.isEmpty() ? 0 : 1;
    }

    /** The caller's level, from their authorities. */
    private static int callerRank() {
        if (currentUserHas(Permission.SYSTEM_ADMIN)) return 3;
        if (currentUserHas(Permission.ROLES_MANAGE)) return 2;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> isPermission(a.getAuthority())) ? 1 : 0;
    }

    /**
     * Whether the caller stands above the user (ТЗ 2.3): a system administrator
     * above everyone, anyone else only above lower levels.
     *
     * @param target the user acted on
     * @return {@code true} if the caller may ban, time out or take roles from them
     * @since v.0.1
     */
    public boolean outranks(User target) {
        int caller = callerRank();
        return caller == 3 || caller > rank(target.getRoles());
    }

    private void requireMayRestrict(User target) {
        Long actorId = auditLogService.currentActorId();
        if (actorId != null && actorId.equals(target.getDiscordId())) {
            throw new IllegalArgumentException("You can't restrict yourself");
        }
        if (!outranks(target)) {
            throw new HierarchyException("A moderator can't restrict a platform administrator");
        }
    }

    private void record(User user, UserRestriction.Type type, String reason, LocalDateTime until) {
        UserRestriction r = new UserRestriction();
        r.setUserDiscordId(user.getDiscordId());
        r.setType(type);
        r.setReason(reason);
        r.setEndsAt(until);
        r.setCreatedBy(auditLogService.currentActorId());
        r.setCreatedByName(auditLogService.currentActorUsername());
        restrictionRepository.save(r);
    }

    /** Marks the restriction of this kind still in force as lifted by the caller; one that ran out simply ended. */
    private void liftOpen(User user, UserRestriction.Type type) {
        LocalDateTime now = LocalDateTime.now();
        restrictionRepository.findFirstByUserDiscordIdAndTypeAndLiftedAtIsNullOrderByCreatedAtDesc(user.getDiscordId(), type)
                .filter(r -> r.getEndsAt() == null || r.getEndsAt().isAfter(now))
                .ifPresent(r -> {
                    r.setLiftedAt(now);
                    r.setLiftedBy(auditLogService.currentActorId());
                    r.setLiftedByName(auditLogService.currentActorUsername());
                    restrictionRepository.save(r);
                });
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static boolean isPermission(String authority) {
        for (Permission p : Permission.values()) if (p.name().equals(authority)) return true;
        return false;
    }

    private static boolean currentUserHas(Permission permission) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> permission.name().equals(a.getAuthority()));
    }
}
