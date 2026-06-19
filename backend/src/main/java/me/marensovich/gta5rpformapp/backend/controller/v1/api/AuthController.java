package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.auth.AuthResponse;
import me.marensovich.gta5rpformapp.backend.dto.auth.DiscordAuthRequest;
import me.marensovich.gta5rpformapp.backend.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * REST controller for authentication operations.
 * <p>
 * Provides endpoints for manual Discord authentication and logout functionality.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Performs manual authentication using Discord credentials.
     * <p>
     * This endpoint allows authentication without the OAuth2 flow by providing
     * a Discord ID and username directly. Primarily used for development or
     * fallback authentication scenarios.
     * </p>
     *
     * @param request the {@link DiscordAuthRequest} containing the Discord ID and username
     * @return an {@link AuthResponse} containing the generated JWT token
     * @since v.0.1
     */
    @PostMapping("/discord")
    public AuthResponse login(@RequestBody DiscordAuthRequest request) {

        String jwt = authService.loginWithDiscordManual(
                request.discordId(),
                request.username()
        );

        return new AuthResponse(jwt);
    }

    /**
     * Logs out the current user by clearing the JWT cookie.
     * <p>
     * Creates a new cookie with the same name ("jwt"), sets its max age to 0
     * (effectively deleting it), and adds it to the response. This clears the
     * authentication cookie on the client side.
     * </p>
     *
     * @param response the HTTP response used to add the cookie
     * @return a {@link ResponseEntity} containing a success message
     * @since v.0.1
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("jwt", null);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        return ResponseEntity.status(HttpStatus.OK).body(Map.of("message", "Logout Successful!"));
    }
}