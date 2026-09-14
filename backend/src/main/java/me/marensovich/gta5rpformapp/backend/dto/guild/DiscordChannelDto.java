package me.marensovich.gta5rpformapp.backend.dto.guild;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;

/**
 * Data Transfer Object representing a Discord text channel, for populating a
 * channel picker in the form-builder UI.
 *
 * @param id   the Discord channel snowflake ID
 * @param name the channel's display name
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record DiscordChannelDto(
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        String name
) {
    /**
     * Builds a {@link DiscordChannelDto} from a raw Discord API channel record.
     *
     * @param channel the channel as reported by Discord
     * @return the corresponding DTO
     * @since v.0.1
     */
    public static DiscordChannelDto from(DiscordBotClient.DiscordChannel channel) {
        return new DiscordChannelDto(Long.parseUnsignedLong(channel.id()), channel.name());
    }
}
