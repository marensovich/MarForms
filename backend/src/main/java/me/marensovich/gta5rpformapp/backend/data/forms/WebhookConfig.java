package me.marensovich.gta5rpformapp.backend.data.forms;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Configuration class for Discord webhook integration.
 * <p>
 * Contains settings for sending form submission notifications to Discord
 * via webhooks. Supports custom bot names, avatars, embeds, and message content.
 * </p>
 * <p>
 * All text fields support variable substitution for dynamic content.
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
     * Discord webhook URL.
     * <p>
     * Required field. Format:
     * {@code https://discord.com/api/webhooks/{webhookId}/{webhookToken}}
     * </p>
     *
     * @since v.0.1
     */
    private String url;

    /**
     * Bot display name override.
     * <p>
     * If not set, the webhook's default name from Discord will be used.
     * Supports variable substitution.
     * </p>
     *
     * @since v.0.1
     */
    private String botName;

    /**
     * Bot avatar URL override.
     * <p>
     * If not set, the webhook's default avatar from Discord will be used.
     * Must be a valid image URL.
     * </p>
     *
     * @since v.0.1
     */
    private String avatarUrl;

    /**
     * Plain-text content above the embed.
     * <p>
     * Supports Discord markdown formatting and @mentions.
     * Supports variable substitution.
     * </p>
     *
     * @since v.0.1
     */
    private String content;

    /**
     * Embed sidebar color as a decimal integer.
     * <p>
     * Examples:
     * <ul>
     *     <li>5793266 — blurple (Discord default)</li>
     *     <li>65280 — green</li>
     *     <li>16711680 — red</li>
     * </ul>
     * </p>
     *
     * @since v.0.1
     */
    private Integer color;

    /**
     * Embed title override.
     * <p>
     * Defaults to the form title if not specified.
     * Supports variable substitution.
     * </p>
     *
     * @since v.0.1
     */
    private String embedTitle;

    /**
     * The main description text of the embed.
     * <p>
     * Supports Discord markdown formatting and line breaks.
     * Supports variable substitution.
     * </p>
     *
     * @since v.0.1
     */
    private String embedDescription;

    /**
     * Author name override.
     * <p>
     * Defaults to "Submitted by {username}" if not specified.
     * Supports variable substitution.
     * </p>
     *
     * @since v.0.1
     */
    private String authorName;

    /**
     * Icon URL shown next to the author name (small circle).
     * <p>
     * Must be a valid image URL.
     * </p>
     *
     * @since v.0.1
     */
    private String authorIconUrl;

    /**
     * URL that makes the author name a clickable link.
     *
     * @since v.0.1
     */
    private String authorUrl;

    /**
     * Small thumbnail image in the top-right corner.
     * <p>
     * Must be a valid image URL.
     * </p>
     *
     * @since v.0.1
     */
    private String thumbnailUrl;

    /**
     * Large image shown below the answer fields.
     * <p>
     * Must be a valid image URL.
     * </p>
     *
     * @since v.0.1
     */
    private String imageUrl;

    /**
     * When {@code true}, answer fields are rendered side-by-side (inline).
     * <p>
     * When {@code false} or {@code null}, fields are rendered in full width.
     * </p>
     *
     * @since v.0.1
     */
    private Boolean fieldsInline;
}