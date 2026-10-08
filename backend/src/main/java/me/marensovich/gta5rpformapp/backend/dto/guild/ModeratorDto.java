package me.marensovich.gta5rpformapp.backend.dto.guild;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;

import java.time.LocalDateTime;

/**
 * A guild moderator, as shown on the moderator-management screen.
 *
 * @param discordId the moderator's Discord ID (serialized as a string — snowflakes overflow JS numbers)
 * @param username  the moderator's Discord username
 * @param since     when their membership row was created
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record ModeratorDto(
        @JsonSerialize(using = ToStringSerializer.class)
        Long discordId,
        String username,
        LocalDateTime since
) {
    public static ModeratorDto from(GuildMembership membership) {
        return new ModeratorDto(
                membership.getUser().getDiscordId(),
                membership.getUser().getDiscordUsername(),
                membership.getCreatedAt());
    }
}
