package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.entity.UserRestriction;
import me.marensovich.gta5rpformapp.backend.dto.user.AssignRolesRequest;
import me.marensovich.gta5rpformapp.backend.dto.user.BanUserRequest;
import me.marensovich.gta5rpformapp.backend.dto.user.TimeoutRequest;
import me.marensovich.gta5rpformapp.backend.service.AuditLogService;
import me.marensovich.gta5rpformapp.backend.service.UserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * The platform's «Пользователи» (ТЗ 6.3): everyone who signed in with
 * Discord, their platform roles and restrictions. A ban closes the whole
 * platform, a time-out only sending submissions and the panel; both carry a
 * reason the user sees, and the hierarchy of ТЗ 2.3 applies to both and to
 * taking roles away.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserService userService;
    private final AuditLogService auditLogService;

    /** A platform role as a chip. */
    public record RoleChip(UUID id, String name, String color) {
    }

    /**
     * A row of the users table.
     *
     * @param status    {@code ACTIVE}, {@code TIMEOUT} or {@code BANNED}
     * @param until     the end of a time-out
     * @param reason    why the user is restricted
     * @param outranked the caller stands no higher than the user (ТЗ 2.3): no ban, time-out or taking roles
     * @param self      the row is the caller
     */
    public record UserRow(@JsonSerialize(using = ToStringSerializer.class) Long discordId, String username, String avatarUrl,
                          List<RoleChip> roles, String status, LocalDateTime until, String reason,
                          LocalDateTime lastSeenAt, boolean outranked, boolean self) {
    }

    /** A ban or time-out in the history the «Разбан» dialog shows. */
    public record RestrictionRow(String type, String reason, LocalDateTime endsAt, LocalDateTime createdAt,
                                 @JsonSerialize(using = ToStringSerializer.class) Long createdBy, String createdByName,
                                 LocalDateTime liftedAt, String liftedByName) {
        static RestrictionRow from(UserRestriction r) {
            return new RestrictionRow(r.getType().name(), r.getReason(), r.getEndsAt(), r.getCreatedAt(), r.getCreatedBy(),
                    r.getCreatedByName(), r.getLiftedAt(), r.getLiftedByName());
        }
    }

    /**
     * The users, newest first.
     *
     * @param q      part of the username, or the Discord ID
     * @param roleId one platform role
     * @param status {@code active}, {@code timeout} or {@code banned}
     * @param page   0-based
     * @param size   at most 100
     * @return the page
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('USERS_MODERATE') or hasAuthority('ROLES_MANAGE')")
    @GetMapping
    public Page<UserRow> list(@RequestParam(required = false) String q,
                              @RequestParam(required = false) UUID roleId,
                              @RequestParam(required = false) String status,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "25") int size) {
        PageRequest request = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        return userService.search(q, roleId, status, request).map(this::row);
    }

    /** All users and new this week, active in 30 days, bans and time-outs (ТЗ 6.3 KPI). */
    @PreAuthorize("hasAuthority('USERS_MODERATE') or hasAuthority('ROLES_MANAGE')")
    @GetMapping("/stats")
    public Map<String, Long> stats() {
        return userService.stats();
    }

    /** The user's bans and time-outs, the latest first. */
    @PreAuthorize("hasAuthority('USERS_MODERATE')")
    @GetMapping("/{discordId}/restrictions")
    public List<RestrictionRow> restrictions(@PathVariable Long discordId) {
        return userService.restrictions(discordId).stream().map(RestrictionRow::from).toList();
    }

    @PreAuthorize("hasAuthority('ROLES_MANAGE')")
    @PutMapping("/{discordId}/roles")
    public UserRow assignRoles(@PathVariable Long discordId, @Valid @RequestBody AssignRolesRequest request) {
        return row(userService.assignRoles(discordId, request));
    }

    @PreAuthorize("hasAuthority('USERS_MODERATE')")
    @PostMapping("/{discordId}/ban")
    public UserRow ban(@PathVariable Long discordId, @Valid @RequestBody BanUserRequest request) {
        return row(userService.ban(discordId, request));
    }

    @PreAuthorize("hasAuthority('USERS_MODERATE')")
    @PostMapping("/{discordId}/unban")
    public UserRow unban(@PathVariable Long discordId) {
        return row(userService.unban(discordId));
    }

    @PreAuthorize("hasAuthority('USERS_MODERATE')")
    @PostMapping("/{discordId}/timeout")
    public UserRow timeout(@PathVariable Long discordId, @Valid @RequestBody TimeoutRequest request) {
        return row(userService.timeout(discordId, request));
    }

    @PreAuthorize("hasAuthority('USERS_MODERATE')")
    @DeleteMapping("/{discordId}/timeout")
    public UserRow liftTimeout(@PathVariable Long discordId) {
        return row(userService.liftTimeout(discordId));
    }

    private UserRow row(User u) {
        String status = u.isBanned() ? "BANNED" : u.isTimedOut() ? "TIMEOUT" : "ACTIVE";
        List<RoleChip> roles = u.getRoles().stream()
                .sorted(Comparator.comparingInt((Role r) -> -UserService.rank(Set.of(r))).thenComparing(Role::getName))
                .map(r -> new RoleChip(r.getId(), r.getName(), r.getColor()))
                .toList();
        String avatar = u.getDiscordAvatar() == null ? null
                : "https://cdn.discordapp.com/avatars/" + u.getDiscordId() + "/" + u.getDiscordAvatar() + ".png?size=64";
        return new UserRow(u.getDiscordId(), u.getDiscordUsername(), avatar, roles, status,
                u.isTimedOut() ? u.getBannedUntil() : null, status.equals("ACTIVE") ? null : u.getRestrictionReason(),
                u.getLastSeenAt(), !userService.outranks(u), Objects.equals(auditLogService.currentActorId(), u.getDiscordId()));
    }
}
