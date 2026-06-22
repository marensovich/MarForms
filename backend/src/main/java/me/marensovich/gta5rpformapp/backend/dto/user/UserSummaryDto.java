package me.marensovich.gta5rpformapp.backend.dto.user;

import me.marensovich.gta5rpformapp.backend.database.entity.User;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * Data Transfer Object representing a summarized view of a user.
 * <p>
 * Contains basic user information and ban status. Used for administrative
 * user listings and overview displays.
 * </p>
 *
 * @param id                the internal database ID of the user
 * @param discordId         the Discord ID of the user
 * @param discordUsername   the Discord username of the user
 * @param roles             the set of role names assigned to the user
 * @param bannedPermanently indicates whether the user is permanently banned
 * @param bannedUntil       the ISO string representation of the temporary ban expiration,
 *                          or {@code null} if no active temporary ban
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record UserSummaryDto(
        Long id,
        Long discordId,
        String discordUsername,
        Set<String> roles,
        boolean bannedPermanently,
        String bannedUntil
) {
    /**
     * Converts a {@link User} entity to a {@link UserSummaryDto}.
     *
     * @param user the user entity to convert
     * @return a new {@link UserSummaryDto} containing the summarized user data
     * @since v.0.1
     */
    public static UserSummaryDto from(User user) {
        return new UserSummaryDto(
                user.getId(),
                user.getDiscordId(),
                user.getDiscordUsername(),
                user.getRoles().stream().map(r -> r.getName()).collect(Collectors.toSet()),
                user.isBannedPermanently(),
                user.getBannedUntil() != null ? user.getBannedUntil().toString() : null
        );
    }
}