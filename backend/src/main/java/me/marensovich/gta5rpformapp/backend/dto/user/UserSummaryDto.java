package me.marensovich.gta5rpformapp.backend.dto.user;

import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.dto.role.RoleDto;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * Data Transfer Object representing a summarized view of a user.
 * <p>
 * Contains basic user information, roles, and ban status. Used for administrative
 * user listings and overview displays.
 * </p>
 *
 * @param id                the internal database ID of the user
 * @param discordId         the Discord ID of the user
 * @param discordUsername   the Discord username of the user
 * @param roles             the set of full {@link RoleDto} objects assigned to the user
 * @param bannedPermanently indicates whether the user is permanently banned
 * @param bannedUntil       the ISO string representation of the temporary ban expiration,
 *                          or {@code null} if no active temporary ban
 * @param currentlyBanned   computed flag indicating if the user is currently banned
 *                          (either permanently or temporarily)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record UserSummaryDto(
        Long id,
        Long discordId,
        String discordUsername,
        Set<RoleDto> roles,
        boolean bannedPermanently,
        String bannedUntil,
        boolean currentlyBanned
) {
    /**
     * Converts a {@link User} entity to a {@link UserSummaryDto}.
     * <p>
     * Maps user roles to {@link RoleDto} objects and computes the
     * {@code currentlyBanned} flag using {@link User#isCurrentlyBanned()}.
     * </p>
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
                user.getRoles().stream()
                        .map(RoleDto::from)
                        .collect(Collectors.toSet()),
                user.isBannedPermanently(),
                user.getBannedUntil() != null ? user.getBannedUntil().toString() : null,
                user.isCurrentlyBanned()
        );
    }
}