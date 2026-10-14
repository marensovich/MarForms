package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.guild.CreateWebhookRequest;
import me.marensovich.gta5rpformapp.backend.dto.guild.CreatedWebhookResponse;
import me.marensovich.gta5rpformapp.backend.dto.guild.DiscordChannelDto;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

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
    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRole(#guildId, 'OWNER')")
    @GetMapping("/channels")
    public List<DiscordChannelDto> channels(@PathVariable Long guildId) {
        return discordBotClient.fetchTextChannels(guildId).stream()
                .map(DiscordChannelDto::from)
                .toList();
    }

    /**
     * Lists a guild's Discord roles for the RoleGate picker (E2.1, #66),
     * without {@code @everyone} (its ID is the guild's: every member has it,
     * so it gates nothing). Empty if the bot can't see the guild.
     *
     * @param guildId the Discord guild snowflake ID
     * @return the guild's roles, sorted by name
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRole(#guildId, 'OWNER')")
    @GetMapping("/roles")
    public List<DiscordBotClient.DiscordRole> roles(@PathVariable Long guildId) {
        return discordBotClient.fetchRoles(guildId).entrySet().stream()
                .filter(entry -> !entry.getKey().equals(guildId))
                .map(Map.Entry::getValue)
                .sorted(Comparator.comparing(DiscordBotClient.DiscordRole::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /**
     * Creates a Discord webhook in the given channel via the bot, for use as
     * a form's notification destination.
     * <p>
     * Requires the {@code FORMS_MANAGE} authority. The {@code guildId} path
     * segment is only used to keep the URL consistent with {@link #channels};
     * webhook creation itself is channel-scoped on Discord's side.
     * </p>
     *
     * @param guildId   the Discord guild snowflake ID (unused beyond the URL shape)
     * @param channelId the Discord channel snowflake ID to create the webhook in
     * @param request   the webhook's display name
     * @return the created webhook's URL, ready to store on a form
     * @throws NotFoundException if the bot couldn't create the webhook (not in the
     *                           guild, missing permission, or no bot token configured)
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRole(#guildId, 'OWNER')")
    @PostMapping("/channels/{channelId}/webhooks")
    public ResponseEntity<CreatedWebhookResponse> createWebhook(
            @PathVariable Long guildId,
            @PathVariable Long channelId,
            @RequestBody(required = false) CreateWebhookRequest request) {
        String name = request != null && request.name() != null && !request.name().isBlank()
                ? request.name() : "MarForms";
        var webhook = discordBotClient.createWebhook(guildId, channelId, name)
                .orElseThrow(() -> new NotFoundException(
                        "Could not create a webhook in channel " + channelId
                                + " — the bot may not have access to it"));
        return ResponseEntity.status(HttpStatus.CREATED).body(new CreatedWebhookResponse(webhook.url()));
    }
}
