package me.marensovich.gta5rpformapp.backend.data.forms;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Configuration class for Discord webhook integration.
 * <p>
 * Contains settings for sending form submission notifications to Discord
 * via webhooks. Supports custom bot names, avatars, embeds, and message content.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Data
@NoArgsConstructor
public class WebhookConfig {

    /**
     * The Discord webhook URL.
     * <p>
     * This is the endpoint where the webhook message will be sent.
     * Format: {@code https://discord.com/api/webhooks/{webhookId}/{webhookToken}}
     * </p>
     *
     * @since v.0.1
     */
    private String url;

    /**
     * The display name of the bot that sends the webhook message.
     * <p>
     * Overrides the default webhook name. If not set, the webhook's
     * default name from Discord will be used.
     * </p>
     *
     * @since v.0.1
     */
    private String botName;

    /**
     * The URL of the avatar image for the bot.
     * <p>
     * Overrides the default webhook avatar. Must be a valid image URL.
     * </p>
     *
     * @since v.0.1
     */
    private String avatarUrl;

    /**
     * The plain text content of the webhook message.
     * <p>
     * Supports Discord markdown formatting and mention syntax.
     * </p>
     *
     * @since v.0.1
     */
    private String content;

    /**
     * The color of the embed sidebar in hexadecimal format (without #).
     * <p>
     * Example: {@code 0x00FF00} for green, {@code 0xFF0000} for red.
     * </p>
     *
     * @since v.0.1
     */
    private Integer color;

    /**
     * The title displayed at the top of the embed.
     *
     * @since v.0.1
     */
    private String embedTitle;

    /**
     * The main description text of the embed.
     * <p>
     * Supports Discord markdown formatting and line breaks.
     * </p>
     *
     * @since v.0.1
     */
    private String embedDescription;
}