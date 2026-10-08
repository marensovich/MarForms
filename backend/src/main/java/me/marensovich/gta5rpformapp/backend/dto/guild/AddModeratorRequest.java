package me.marensovich.gta5rpformapp.backend.dto.guild;

/**
 * Request to make an existing user a moderator of a guild.
 * <p>
 * Either field identifies the user — {@code discordId} wins if both are
 * given. The user must have logged into the service at least once (MVP,
 * product spec раздел 5.3.1).
 * </p>
 *
 * @param discordId the user's Discord ID, as a string
 * @param username  the user's exact Discord username (case-insensitive)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record AddModeratorRequest(String discordId, String username) {
}
