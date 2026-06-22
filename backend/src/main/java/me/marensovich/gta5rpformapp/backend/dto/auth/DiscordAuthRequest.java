package me.marensovich.gta5rpformapp.backend.dto.auth;

/**
 * Data Transfer Object representing a manual Discord authentication request.
 * <p>
 * Used for authentication without the OAuth2 flow, primarily for development
 * or fallback scenarios.
 * </p>
 *
 * @param discordId the Discord ID of the user attempting to authenticate
 * @param username  the Discord username of the user attempting to authenticate
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record DiscordAuthRequest(
        Long discordId,
        String username
) {
}