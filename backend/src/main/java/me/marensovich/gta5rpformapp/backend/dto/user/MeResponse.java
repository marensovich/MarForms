package me.marensovich.gta5rpformapp.backend.dto.user;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;

import java.util.Set;

/**
 * Data Transfer Object representing the currently authenticated user's information.
 * <p>
 * Contains user identity, assigned roles, permissions, and a permission hash
 * for efficient frontend permission checking.
 * </p>
 *
 * @param discordId       the Discord ID of the authenticated user
 * @param discordUsername the Discord username of the authenticated user
 * @param roles           the set of role names assigned to the user
 * @param permissions     the set of permissions granted to the user
 * @param permissionsHash a hash value representing the user's permission set
 *                        for frontend permission caching and quick checks
 * @param timeout         the time-out in force, {@code null} if none
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record MeResponse(
        @JsonSerialize(using = ToStringSerializer.class)
        Long discordId,
        String discordUsername,
        Set<String> roles,
        Set<Permission> permissions,
        long permissionsHash,
        Timeout timeout
) {
    /** A platform time-out in force (ТЗ 6.3): the panel is closed until it ends; the user sees why. */
    public record Timeout(java.time.LocalDateTime until, String reason) {
    }
}