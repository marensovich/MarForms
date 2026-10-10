package me.marensovich.gta5rpformapp.backend.dto.ban;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.time.LocalDateTime;

/**
 * A ban on the guild's ban-list screen.
 *
 * @param discordId        the banned user's Discord ID (serialized as string)
 * @param username         their username, if they have logged in to MarForms
 * @param reason           the reason, if given
 * @param bannedBy         who issued the ban (serialized as string), if known
 * @param bannedByUsername that staff member's username, if known
 * @param createdAt        when the ban was issued
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record BanDto(
        @JsonSerialize(using = ToStringSerializer.class)
        Long discordId,
        String username,
        String reason,
        @JsonSerialize(using = ToStringSerializer.class)
        Long bannedBy,
        String bannedByUsername,
        LocalDateTime createdAt
) {
}
