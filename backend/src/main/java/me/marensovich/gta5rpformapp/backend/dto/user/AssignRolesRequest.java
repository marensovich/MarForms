package me.marensovich.gta5rpformapp.backend.dto.user;

import jakarta.validation.constraints.NotNull;

import java.util.Set;
import java.util.UUID;

/**
 * Data Transfer Object for assigning roles to a user.
 * <p>
 * Contains the set of role IDs to be assigned to the user.
 * </p>
 *
 * @param roleIds the set of role UUIDs to assign to the user (must not be null)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record AssignRolesRequest(
        @NotNull Set<UUID> roleIds
) {
}