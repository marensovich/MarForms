package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.guild.DiscordChannelDto;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller for guild-scoped Discord data used by the form builder.
 * <p>
 * Backed by the bot's own token ({@link DiscordBotClient}), not the current
 * user's OAuth2 token — results are empty if the bot hasn't been added to
 * the guild or lacks the {@code VIEW_CHANNEL} permission there.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/guilds/{guildId}")
@RequiredArgsConstructor
public class GuildController {

    private final DiscordBotClient discordBotClient;

    /**
     * Lists the text channels of a guild that the bot can see — for the
     * webhook-destination picker in the form builder.
     * <p>
     * Requires the {@code FORMS_MANAGE} authority.
     * </p>
     *
     * @param guildId the Discord guild snowflake ID
     * @return the guild's bot-visible text channels
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORMS_MANAGE')")
    @GetMapping("/channels")
    public List<DiscordChannelDto> channels(@PathVariable Long guildId) {
        return discordBotClient.fetchTextChannels(guildId).stream()
                .map(DiscordChannelDto::from)
                .toList();
    }
}
