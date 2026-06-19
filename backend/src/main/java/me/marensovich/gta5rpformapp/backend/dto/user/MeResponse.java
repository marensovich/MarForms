package me.marensovich.gta5rpformapp.backend.dto.user;

import me.marensovich.gta5rpformapp.backend.data.roles.Permission;

import java.util.Set;

/**
 * Data Transfer Object representing the currently authenticated user's information.
 * <p>
 * Contains user identity, assigned roles, and permissions. Used by the frontend
 * to determine the user's access levels and display user information.
 * </p>
 *
 * @param discordId       the Discord ID of the authenticated user
 * @param discordUsername the Discord username of the authenticated user
 * @param roles           the set of role names assigned to the user
 * @param permissions     the set of permissions granted to the user
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record MeResponse(
        Long discordId,
        String discordUsername,
        Set<String> roles,
        Set<Permission> permissions
) {
}