package me.marensovich.gta5rpformapp.backend.dto.guild;

/**
 * Request body for creating a Discord webhook in a specific channel via the bot.
 *
 * @param name the webhook's display name; defaults to "MarForms" if blank
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record CreateWebhookRequest(String name) {
}
