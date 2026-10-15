package me.marensovich.gta5rpformapp.backend.data.notifications;

/**
 * What a notification of the panel's bell is about (#122, ТЗ 7.2).
 *
 * @since v.0.1
 */
public enum NotificationType {
    /** A new submission on the server: to its moderators and owner. */
    NEW_SUBMISSION,
    /** A submission sent again after revision: to its moderators and owner. */
    SUBMISSION_RESUBMITTED,
    /** A form's webhook stopped working (deleted, no channel, no permission): to the owner. */
    WEBHOOK_PROBLEM,
    /** The bot was removed from the server: to the owner. */
    BOT_REMOVED
}
