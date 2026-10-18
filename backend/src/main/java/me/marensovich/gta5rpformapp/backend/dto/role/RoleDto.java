package me.marensovich.gta5rpformapp.backend.dto.role;

import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;

import java.util.Set;
import java.util.UUID;

/**
 * Data Transfer Object representing a role with its permissions.
 * <p>
 * Used to transfer role information between the backend and frontend.
 * </p>
 *
 * @param id          the unique identifier of the role
 * @param name        the display name of the role
 * @param color       the chip colour, #RRGGBB, or {@code null}
 * @param permissions the set of permissions assigned to the role
 * @param system      the system role: it can't be deleted or lose SYSTEM_ADMIN (ТЗ 2.3)
 * @param users       how many users hold the role, when the caller counted them
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record RoleDto(
        UUID id,
        String name,
        String color,
        Set<Permission> permissions,
        boolean system,
        Long users
) {
    /**
     * Converts a {@link Role} entity to a {@link RoleDto}.
     *
     * @param role the role entity to convert
     * @return a new {@link RoleDto} containing the role data
     * @since v.0.1
     */
    public static RoleDto from(Role role) {
        return from(role, null);
    }

    /**
     * Converts a {@link Role}, with how many users hold it (ТЗ 6.4).
     *
     * @param role  the role entity to convert
     * @param users the number of its holders
     * @return the DTO
     * @since v.0.1
     */
    public static RoleDto from(Role role, Long users) {
        return new RoleDto(role.getId(), role.getName(), role.getColor(), role.getPermissions(), role.isSystem(), users);
    }
}
