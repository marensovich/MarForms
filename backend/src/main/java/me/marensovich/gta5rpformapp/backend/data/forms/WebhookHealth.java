package me.marensovich.gta5rpformapp.backend.data.forms;

/**
 * Whether a form's webhook notifications are getting through (E2.4, #74).
 * Submissions are collected regardless: this is only what the owner is told.
 * <ul>
 *     <li>{@link #HEALTHY}: nothing known to be wrong.</li>
 *     <li>{@link #DEGRADED}: notifications may not arrive. Deliveries are
 *     failing and being retried, or the bot lost access to the webhook's
 *     channel or server (the webhook may keep working, but it can no longer
 *     be managed or recreated).</li>
 *     <li>{@link #INVALID}: the webhook no longer exists on Discord;
 *     notifications are not sent until the owner replaces it.</li>
 * </ul>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public enum WebhookHealth {
    HEALTHY,
    DEGRADED,
    INVALID;

    /**
     * Reason codes stored in {@code WebhookConfig.healthReason}, so the UI
     * can explain the status without parsing error text.
     */
    public static final String REASON_DELIVERY_FAILING = "DELIVERY_FAILING";
    public static final String REASON_WEBHOOK_DELETED = "WEBHOOK_DELETED";
    public static final String REASON_BOT_NOT_IN_GUILD = "BOT_NOT_IN_GUILD";
    public static final String REASON_CHANNEL_UNAVAILABLE = "CHANNEL_UNAVAILABLE";
    public static final String REASON_MISSING_PERMISSIONS = "MISSING_PERMISSIONS";

    /**
     * The worse of two statuses ({@code null} counts as nothing known).
     *
     * @param a one status, may be {@code null}
     * @param b another, may be {@code null}
     * @return the more severe one
     */
    public static WebhookHealth worst(WebhookHealth a, WebhookHealth b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.ordinal() >= b.ordinal() ? a : b;
    }
}
