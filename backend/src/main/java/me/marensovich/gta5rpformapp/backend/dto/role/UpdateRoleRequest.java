package me.marensovich.gta5rpformapp.backend.dto.role;

import me.marensovich.gta5rpformapp.backend.data.roles.Permission;

import java.util.Set;

/**
 * Data Transfer Object for updating an existing role.
 * <p>
 * All fields are optional, allowing partial updates to the role configuration.
 * Only provided fields will be updated.
 * </p>
 *
 * @param name        the updated display name of the role (optional)
 * @param permissions the updated set of permissions assigned to the role (optional)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record UpdateRoleRequest(
        String name,
        Set<Permission> permissions
) {
}