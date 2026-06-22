package me.marensovich.gta5rpformapp.backend.dto.auth;

/**
 * Data Transfer Object representing an authentication response.
 * <p>
 * Contains the JWT token returned to the client upon successful authentication.
 * </p>
 *
 * @param token the JWT authentication token
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record AuthResponse(
        String token
) {
}