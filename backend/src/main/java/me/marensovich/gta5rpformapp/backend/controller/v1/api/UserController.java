package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.dto.user.MeResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.stream.Collectors;

/**
 * REST controller for user information endpoints.
 * <p>
 * Provides endpoints for retrieving information about the currently
 * authenticated user.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1")
public class UserController {

    /**
     * Retrieves information about the currently authenticated user.
     * <p>
     * Returns the user's Discord ID, username, assigned roles, and permissions.
     * This endpoint is used by the frontend to determine the user's identity
     * and access levels after authentication.
     * </p>
     *
     * @param principal the currently authenticated user details
     * @return a {@link MeResponse} containing user information
     * @since v.0.1
     */
    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal CustomUserDetails principal) {
        return new MeResponse(
                principal.getDiscordId(),
                principal.getUser().getDiscordUsername(),
                principal.getUser().getRoles().stream().map(r -> r.getName()).collect(Collectors.toSet()),
                principal.getPermissions()
        );
    }
}