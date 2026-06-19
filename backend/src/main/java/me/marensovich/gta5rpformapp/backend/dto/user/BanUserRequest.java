package me.marensovich.gta5rpformapp.backend.dto.user;

/**
 * Data Transfer Object for banning a user.
 * <p>
 * Contains the ban configuration, supporting both permanent and temporary bans.
 * </p>
 *
 * @param permanent      if {@code true}, the user is banned permanently;
 *                       if {@code false}, a temporary ban with a timeout is applied
 * @param timeoutMinutes the duration of the temporary ban in minutes.
 *                       Required when {@code permanent} is {@code false};
 *                       ignored when {@code permanent} is {@code true}.
 *                       A {@code null} or {@code 0} value is treated as a validation error
 *                       by the service layer
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record BanUserRequest(
        boolean permanent,
        Long timeoutMinutes
) {
}