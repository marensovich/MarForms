package me.marensovich.gta5rpformapp.backend.dto.role;

import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;

import java.util.Set;
import java.util.UUID;

/**
 * Data Transfer Object representing a role.
 * <p>
 * Contains the role's identifier, display name, and associated permissions.
 * </p>
 *
 * @param id          the unique identifier of the role
 * @param name        the display name of the role
 * @param color       the chip colour, #RRGGBB, or {@code null}
 * @param permissions the set of permissions assigned to the role
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record RoleDto(
        UUID id,
        String name,
        String color,
        Set<Permission> permissions
) {
    /**
     * Converts a {@link Role} entity to a {@link RoleDto}.
     *
     * @param role the role entity to convert
     * @return a new {@link RoleDto} containing the role data
     * @since v.0.1
     */
    public static RoleDto from(Role role) {
        return new RoleDto(role.getId(), role.getName(), role.getColor(), role.getPermissions());
    }
}