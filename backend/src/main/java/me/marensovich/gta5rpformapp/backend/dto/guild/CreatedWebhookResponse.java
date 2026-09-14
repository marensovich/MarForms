package me.marensovich.gta5rpformapp.backend.dto.guild;

/**
 * Response after creating a Discord webhook via the bot — the URL to store
 * directly on {@code WebhookConfig.url}.
 *
 * @param url the created webhook's executable URL
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record CreatedWebhookResponse(String url) {
}
