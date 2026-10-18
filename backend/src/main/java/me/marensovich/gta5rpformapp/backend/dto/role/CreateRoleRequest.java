package me.marensovich.gta5rpformapp.backend.dto.role;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;

import java.util.Set;
import java.util.UUID;

/**
 * A new platform role (ТЗ 6.4 «Создать роль»).
 *
 * @param name        the name, unique
 * @param color       the chip colour, #RRGGBB, or {@code null}
 * @param permissions its rights, unless copied
 * @param copyFrom    a role whose rights it starts with («Скопировать права из»)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record CreateRoleRequest(
        @NotBlank @Size(max = 50) String name,
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String color,
        Set<Permission> permissions,
        UUID copyFrom
) {
}
