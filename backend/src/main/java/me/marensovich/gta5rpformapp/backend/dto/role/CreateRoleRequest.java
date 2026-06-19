package me.marensovich.gta5rpformapp.backend.dto.role;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;

import java.util.Set;

/**
 * Data Transfer Object for creating a new role.
 * <p>
 * Contains the role name and the set of permissions to be assigned to the role.
 * </p>
 *
 * @param name        the display name of the role (must not be blank)
 * @param permissions the set of permissions to assign to the role (must not be null)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record CreateRoleRequest(
        @NotBlank String name,
        @NotNull Set<Permission> permissions
) {
}