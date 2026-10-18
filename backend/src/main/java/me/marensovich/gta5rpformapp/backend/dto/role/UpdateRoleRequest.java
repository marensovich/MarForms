package me.marensovich.gta5rpformapp.backend.dto.role;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;

import java.util.Set;

/**
 * Changes to a platform role; {@code null} leaves a part as it is. They apply
 * at once: rights are read from the database on every request (ТЗ 9.1).
 *
 * @param name        the new name
 * @param color       the new colour, #RRGGBB
 * @param permissions the new rights
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record UpdateRoleRequest(
        @Size(min = 1, max = 50) String name,
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String color,
        Set<Permission> permissions
) {
}
