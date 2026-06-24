package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.user.AssignRolesRequest;
import me.marensovich.gta5rpformapp.backend.dto.user.BanUserRequest;
import me.marensovich.gta5rpformapp.backend.dto.user.UserSummaryDto;
import me.marensovich.gta5rpformapp.backend.service.UserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller for administrative user management operations.
 * <p>
 * Provides endpoints for managing users with administrative privileges.
 * Different authorities are required for different operations:
 * <ul>
 *     <li>{@code USERS_MODERATE} — for viewing, banning, and unbanning users</li>
 *     <li>{@code ROLES_MANAGE} — for assigning roles to users</li>
 * </ul>
 * </p>
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

    /**
     * Retrieves a paginated list of all users with optional filtering.
     * <p>
     * Supports filtering by:
     * <ul>
     *     <li><b>Search</b> — matches against {@code discordUsername} (case-insensitive, partial match)
     *     or {@code discordId} (partial match)</li>
     *     <li><b>Role ID</b> — filters users who have a specific role assigned</li>
     * </ul>
     * </p>
     * <p>
     * Requires the {@code USERS_MODERATE} authority.
     * </p>
     *
     * @param search   optional search string for username or Discord ID (case-insensitive)
     * @param roleId   optional role UUID to filter users by role
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link UserSummaryDto} containing user summaries
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('USERS_MODERATE')")
    @GetMapping
    public Page<UserSummaryDto> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID roleId,
            Pageable pageable
    ) {
        return userService.listAll(search, roleId, pageable).map(UserSummaryDto::from);
    }

    /**
     * Assigns roles to a specific user.
     * <p>
     * Replaces the user's current roles with the specified set of roles.
     * </p>
     * <p>
     * Requires the {@code ROLES_MANAGE} authority.
     * </p>
     *
     * @param discordId the Discord ID of the user to update
     * @param request   the {@link AssignRolesRequest} containing the role IDs to assign
     * @return a {@link UserSummaryDto} containing the updated user information
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('ROLES_MANAGE')")
    @PutMapping("/{discordId}/roles")
    public UserSummaryDto assignRoles(
            @PathVariable Long discordId,
            @Valid @RequestBody AssignRolesRequest request
    ) {
        return UserSummaryDto.from(userService.assignRoles(discordId, request));
    }

    /**
     * Bans a specific user.
     * <p>
     * Supports both permanent and temporary bans. For temporary bans,
     * a positive timeout duration must be provided in the request.
     * </p>
     * <p>
     * Requires the {@code USERS_MODERATE} authority.
     * </p>
     *
     * @param discordId the Discord ID of the user to ban
     * @param request   the {@link BanUserRequest} containing the ban configuration
     * @return a {@link UserSummaryDto} containing the updated user information with ban status
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('USERS_MODERATE')")
    @PostMapping("/{discordId}/ban")
    public UserSummaryDto ban(
            @PathVariable Long discordId,
            @RequestBody BanUserRequest request
    ) {
        return UserSummaryDto.from(userService.ban(discordId, request));
    }

    /**
     * Unbans a specific user.
     * <p>
     * Removes both permanent and temporary ban status from the user.
     * </p>
     * <p>
     * Requires the {@code USERS_MODERATE} authority.
     * </p>
     *
     * @param discordId the Discord ID of the user to unban
     * @return a {@link UserSummaryDto} containing the updated user information with ban status removed
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('USERS_MODERATE')")
    @PostMapping("/{discordId}/unban")
    public UserSummaryDto unban(@PathVariable Long discordId) {
        return UserSummaryDto.from(userService.unban(discordId));
    }
}