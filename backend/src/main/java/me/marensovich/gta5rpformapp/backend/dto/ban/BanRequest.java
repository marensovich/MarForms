package me.marensovich.gta5rpformapp.backend.dto.ban;

import jakarta.validation.constraints.Size;

/**
 * Request to ban a user from a guild's forms.
 * <p>
 * {@code discordId} wins if both are given. Unlike adding a moderator, a
 * raw Discord ID works for someone who never logged in to MarForms; a
 * {@code username} must belong to a known user.
 * </p>
 *
 * @param discordId the user's Discord ID, as a string
 * @param username  the user's exact Discord username (case-insensitive)
 * @param reason    optional reason, shown to the user on the form's page
 * @param expiresAt when the ban ends, {@code null} = forever
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record BanRequest(
        String discordId,
        String username,
        @Size(max = 500) String reason,
        java.time.LocalDateTime expiresAt
) {
}
