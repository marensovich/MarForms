package me.marensovich.gta5rpformapp.backend.service.discord;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;


/**
 * Looks a webhook up by its URL ({@code GET /webhooks/{id}/{token}}, no
 * auth needed): whether it still exists, and which channel it posts to.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
public class DiscordWebhookLookup {

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Outcome of a lookup.
     *
     * @param state     what Discord said
     * @param guildId   the webhook's guild, when {@code FOUND}
     * @param channelId the webhook's channel, when {@code FOUND}
     */
    public record Result(State state, Long guildId, Long channelId) {
        static Result of(State state) {
            return new Result(state, null, null);
        }
    }

    /**
     * What Discord said about a webhook.
     */
    public enum State {
        FOUND,
        /** 404/401: deleted, or its token was reset. */
        GONE,
        /** Not a Discord webhook URL we can check. */
        NOT_A_DISCORD_WEBHOOK,
        /** Network error, 5xx, rate limit: try again later. */
        UNKNOWN
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record WebhookInfo(@JsonProperty("guild_id") String guildId, @JsonProperty("channel_id") String channelId) {
    }

    /**
     * Looks the webhook up.
     *
     * @param webhookUrl the webhook's URL
     * @return the outcome, never {@code null}
     * @since v.0.1
     */
    public Result lookup(String webhookUrl) {
        DiscordWebhookUrl webhook = DiscordWebhookUrl.parse(webhookUrl).orElse(null);
        if (webhook == null) return Result.of(State.NOT_A_DISCORD_WEBHOOK);
        String url = "https://discord.com/api/v10/webhooks/" + webhook.id() + "/" + webhook.token();
        try {
            WebhookInfo info = restTemplate.getForObject(url, WebhookInfo.class);
            if (info == null) return Result.of(State.UNKNOWN);
            return new Result(State.FOUND, parse(info.guildId()), parse(info.channelId()));
        } catch (HttpClientErrorException.NotFound | HttpClientErrorException.Unauthorized e) {
            return Result.of(State.GONE);
        } catch (Exception e) {
            log.debug("Webhook lookup failed: {}", WebhookUrlCipher.redact(e.getMessage()));
            return Result.of(State.UNKNOWN);
        }
    }

    private static Long parse(String id) {
        try {
            return id == null ? null : Long.parseLong(id);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
