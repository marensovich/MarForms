package me.marensovich.gta5rpformapp.backend.dto.user;

import jakarta.validation.constraints.Size;

/**
 * A platform ban (ТЗ 6.3): it closes the whole platform until lifted.
 *
 * @param reason why — the user sees it
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record BanUserRequest(
        @Size(max = 500) String reason
) {
}
