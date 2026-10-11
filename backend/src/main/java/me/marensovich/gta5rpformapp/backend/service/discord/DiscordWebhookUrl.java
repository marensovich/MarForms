package me.marensovich.gta5rpformapp.backend.service.discord;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A Discord webhook address, reduced to its id and token (security audit,
 * #103). Every request to a webhook goes to a URL rebuilt from these two
 * values on {@code discord.com}, never to the string a user typed — so a
 * form's webhook can't point the server at an internal address (SSRF).
 *
 * @param id    the webhook's snowflake id
 * @param token the webhook's token
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record DiscordWebhookUrl(String id, String token) {

    private static final Pattern URL = Pattern.compile(
            "^https://(?:(?:canary|ptb)\\.)?discord(?:app)?\\.com/api(?:/v\\d{1,2})?/webhooks/(\\d{1,25})/([\\w-]{1,256})/?$");

    private static final String BASE = "https://discord.com/api/webhooks/";

    /**
     * @param url anything a user typed or a stored value
     * @return the webhook, or empty if it isn't a Discord webhook URL
     * @since v.0.1
     */
    public static Optional<DiscordWebhookUrl> parse(String url) {
        if (url == null) return Optional.empty();
        Matcher m = URL.matcher(url.trim());
        return m.matches() ? Optional.of(new DiscordWebhookUrl(m.group(1), m.group(2))) : Optional.empty();
    }

    /** @return the webhook's address on {@code discord.com} */
    public String canonical() {
        return BASE + id + "/" + token;
    }

    /**
     * @param messageId a message the webhook posted
     * @return that message's address
     */
    public String messageUrl(String messageId) {
        if (messageId == null || !messageId.matches("\\d{1,25}")) throw new IllegalArgumentException("Not a message id");
        return canonical() + "/messages/" + messageId;
    }

    @Override
    public String toString() {
        return BASE + id + "/***";
    }
}
