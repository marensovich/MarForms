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

/**
 * REST controller for administrative user management operations.
 * <p>
 * Provides endpoints for managing users with administrative privileges.
 * All endpoints require authentication and specific authorities.
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
     * Retrieves a paginated list of all users.
     * <p>
     * Requires the {@code USER_READ} authority.
     * </p>
     *
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link UserSummaryDto} containing user summaries
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('USER_READ')")
    @GetMapping
    public Page<UserSummaryDto> list(Pageable pageable) {
        return userService.listAll(pageable).map(UserSummaryDto::from);
    }

    /**
     * Assigns roles to a specific user.
     * <p>
     * Requires the {@code USER_UPDATE} authority.
     * </p>
     *
     * @param discordId the Discord ID of the user to update
     * @param request   the {@link AssignRolesRequest} containing the roles to assign
     * @return a {@link UserSummaryDto} containing the updated user information
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('USER_UPDATE')")
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
     * Requires the {@code USER_UPDATE} authority.
     * </p>
     *
     * @param discordId the Discord ID of the user to ban
     * @param request   the {@link BanUserRequest} containing the ban reason
     * @return a {@link UserSummaryDto} containing the updated user information with ban status
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('USER_UPDATE')")
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
     * Requires the {@code USER_UPDATE} authority.
     * </p>
     *
     * @param discordId the Discord ID of the user to unban
     * @return a {@link UserSummaryDto} containing the updated user information with ban status removed
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('USER_UPDATE')")
    @PostMapping("/{discordId}/unban")
    public UserSummaryDto unban(@PathVariable Long discordId) {
        return UserSummaryDto.from(userService.unban(discordId));
    }
}