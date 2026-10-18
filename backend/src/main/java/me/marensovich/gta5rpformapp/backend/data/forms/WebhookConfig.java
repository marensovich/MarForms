package me.marensovich.gta5rpformapp.backend.data.forms;

import java.util.List;

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

    /**
     * Set when Discord has told us this webhook no longer exists (404 —
     * deleted directly on Discord, outside this app). Delivery is skipped
     * for a webhook marked invalid rather than retried forever.
     * <p>
     * System-managed, kept in sync with {@link #health} ({@code INVALID}).
     * It round-trips through the same JSON as every other field
     * here since {@code Form.webhooks} is a single JSON column with no
     * separate internal-vs-public projection. One consequence, treated as
     * intentional rather than a bug: editing and re-saving a form's webhooks
     * through the current UI (which doesn't know about this field) always
     * clears it back to {@code null} — reads as "the owner touched this
     * webhook, give it another chance" rather than needing a dedicated
     * "un-invalidate" action.
     * </p>
     *
     * @since v.0.1
     */
    private Boolean invalid;

    /**
     * The last error seen for this webhook (delivery or health check),
     * kept for diagnosis.
     *
     * @since v.0.1
     */
    private String lastError;

    /**
     * Whether notifications are getting through (E2.4). System-managed,
     * like {@link #invalid}: {@code null} means nothing known to be wrong.
     *
     * @since v.0.1
     */
    private WebhookHealth health;

    /**
     * Why {@link #health} is what it is, one of the {@code WebhookHealth.REASON_*}
     * codes, or {@code null} when healthy.
     *
     * @since v.0.1
     */
    private String healthReason;

    /**
     * When {@link #health} last changed or was confirmed, ISO-8601.
     *
     * @since v.0.1
     */
    private String healthCheckedAt;

    /** A new submission (ТЗ ФТ-5.5.1). */
    public static final String EVENT_SUBMISSION = "SUBMISSION";
    /** A moderator's decision. */
    public static final String EVENT_DECISION = "DECISION";

    /**
     * What this webhook announces: {@link #EVENT_SUBMISSION}, {@link #EVENT_DECISION};
     * {@code null} or empty = both (ТЗ ФТ-5.5.1).
     *
     * @since v.0.1
     */
    private List<String> events;

    /** The channel the bot created this webhook in, when it did — to name it in the list. */
    private String channelId;

    /** See {@link #channelId}. */
    private String channelName;

    /**
     * When a notification last got through, ISO-8601 (ТЗ ФТ-5.5.1).
     * System-managed, like {@link #health}.
     *
     * @since v.0.1
     */
    private String lastDeliveredAt;

    /** Whether this webhook announces an event. */
    public boolean wants(String event) {
        return events == null || events.isEmpty() || events.contains(event);
    }

    /**
     * The effective status, also honouring {@link #invalid} on webhooks
     * written before {@link #health} existed.
     *
     * @return never {@code null}
     * @since v.0.1
     */
    public WebhookHealth effectiveHealth() {
        if (Boolean.TRUE.equals(invalid)) return WebhookHealth.INVALID;
        return health != null ? health : WebhookHealth.HEALTHY;
    }
}