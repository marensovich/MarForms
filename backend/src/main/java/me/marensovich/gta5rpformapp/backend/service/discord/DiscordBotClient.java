package me.marensovich.gta5rpformapp.backend.service.discord;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Client for interacting with the Discord API using the bot's own token.
 * <p>
 * Distinct from {@link DiscordApiClient}, which acts on behalf of a signed-in
 * user with their OAuth2 access token. Every call here degrades gracefully
 * (returns empty) rather than throwing — the bot may not have been added to
 * a given guild, may lack permissions, or {@code discord.bot.token} may not
 * be configured at all (e.g. in tests).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
public class DiscordBotClient {

    private static final String DISCORD_API_BASE = "https://discord.com/api";

    /** Discord channel type value for a standard text channel. */
    private static final int CHANNEL_TYPE_GUILD_TEXT = 0;

    private final RestTemplate restTemplate = new RestTemplate();
    private final String botToken;

    public DiscordBotClient(@Value("${discord.bot.token:}") String botToken) {
        this.botToken = botToken;
    }

    private HttpEntity<Void> authenticatedRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Bot " + botToken);
        return new HttpEntity<>(headers);
    }

    /**
     * Fetches a guild's real name and icon hash from Discord, if the bot is a
     * member of it and a token is configured.
     *
     * @param guildId the Discord guild snowflake ID
     * @return the guild info, or empty if unavailable for any reason
     * @since v.0.1
     */
    public Optional<DiscordGuildInfo> fetchGuild(Long guildId) {
        if (botToken.isBlank()) return Optional.empty();
        try {
            ResponseEntity<DiscordGuildInfo> response = restTemplate.exchange(
                    DISCORD_API_BASE + "/guilds/" + guildId,
                    HttpMethod.GET,
                    authenticatedRequest(),
                    DiscordGuildInfo.class
            );
            return Optional.ofNullable(response.getBody());
        } catch (Exception e) {
            log.warn("Failed to fetch guild {} via bot token: {}", guildId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Fetches the text channels of a guild that the bot can see.
     *
     * @param guildId the Discord guild snowflake ID
     * @return the guild's text channels, or an empty list if unavailable
     * @since v.0.1
     */
    public List<DiscordChannel> fetchTextChannels(Long guildId) {
        if (botToken.isBlank()) return List.of();
        try {
            ResponseEntity<DiscordChannel[]> response = restTemplate.exchange(
                    DISCORD_API_BASE + "/guilds/" + guildId + "/channels",
                    HttpMethod.GET,
                    authenticatedRequest(),
                    DiscordChannel[].class
            );
            DiscordChannel[] body = response.getBody();
            if (body == null) return List.of();
            return Arrays.stream(body)
                    .filter(c -> c.type() == CHANNEL_TYPE_GUILD_TEXT)
                    .toList();
        } catch (Exception e) {
            log.warn("Failed to fetch channels for guild {}: {}", guildId, e.getMessage());
            return List.of();
        }
    }

    /**
     * A guild as reported by the Discord API.
     *
     * @param id   the guild ID as a string
     * @param name the guild's display name
     * @param icon the guild's icon hash, or {@code null} if it has none
     * @since v.0.1
     */
    public record DiscordGuildInfo(String id, String name, String icon) {
    }

    /**
     * A guild channel as reported by the Discord API.
     *
     * @param id   the channel ID as a string
     * @param name the channel's display name
     * @param type the Discord channel type (0 = text; see {@link #CHANNEL_TYPE_GUILD_TEXT})
     * @since v.0.1
     */
    public record DiscordChannel(String id, String name, int type) {
    }
}
