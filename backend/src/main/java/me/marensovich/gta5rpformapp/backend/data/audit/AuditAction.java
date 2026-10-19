package me.marensovich.gta5rpformapp.backend.data.audit;

/**
 * Enumeration of all auditable actions in the system.
 * Each value corresponds to one category of log entry.
 * <p>
 * Actions are organized by functional areas:
 * <ul>
 *     <li><b>User</b> — login, ban, unban, role updates</li>
 *     <li><b>Form</b> — create, update, delete</li>
 *     <li><b>Submission</b> — create, delete</li>
 *     <li><b>Role</b> — create, update, delete</li>
 *     <li><b>Settings</b> — update</li>
 * </ul>
 * </p>
 * <p>
 * Used by {@link me.marensovich.gta5rpformapp.backend.service.AuditLogService}
 * for tracking user actions and system events.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public enum AuditAction {

    /**
     * User login event.
     * <p>
     * Logged when a user successfully authenticates via Discord OAuth2
     * or manual login.
     * </p>
     *
     * @since v.0.1
     */
    USER_LOGIN,

    /**
     * User banned event.
     * <p>
     * Logged when an administrator bans a user (permanently or temporarily).
     * </p>
     *
     * @since v.0.1
     */
    USER_BANNED,

    /**
     * User unbanned event.
     * <p>
     * Logged when an administrator removes a ban from a user.
     * </p>
     *
     * @since v.0.1
     */
    USER_UNBANNED,

    /** A platform time-out: no submissions and no panel until it ends (ТЗ 6.3). */
    USER_TIMED_OUT,

    /** A platform time-out lifted before its end. */
    USER_TIMEOUT_LIFTED,

    /**
     * User roles updated event.
     * <p>
     * Logged when an administrator assigns or modifies roles for a user.
     * </p>
     *
     * @since v.0.1
     */
    USER_ROLES_UPDATED,

    /**
     * Form created event.
     * <p>
     * Logged when a new form is created.
     * </p>
     *
     * @since v.0.1
     */
    FORM_CREATED,

    /**
     * Form updated event.
     * <p>
     * Logged when an existing form is modified (schema, channels, webhooks, etc.).
     * </p>
     *
     * @since v.0.1
     */
    FORM_UPDATED,

    /**
     * Form deleted event.
     * <p>
     * Logged when a form is permanently deleted from the system.
     * </p>
     *
     * @since v.0.1
     */
    FORM_DELETED,

    /**
     * Submission created event.
     * <p>
     * Logged when a user submits a response to a form.
     * </p>
     *
     * @since v.0.1
     */
    SUBMISSION_CREATED,

    /**
     * Submission deleted event.
     * <p>
     * Logged when an administrator deletes a form submission.
     * </p>
     *
     * @since v.0.1
     */
    SUBMISSION_DELETED,

    /**
     * A moderator approved, rejected or requested revision of a submission.
     *
     * @since v.0.1
     */
    SUBMISSION_DECIDED,

    /**
     * The bot couldn't tell the author about a decision: closed DMs, no shared
     * server or no bot (#120). The decision itself stands.
     *
     * @since v.0.1
     */
    SUBMISSION_DM_FAILED,

    /**
     * Role created event.
     * <p>
     * Logged when a new role is created.
     * </p>
     *
     * @since v.0.1
     */
    ROLE_CREATED,

    /**
     * Role updated event.
     * <p>
     * Logged when an existing role is modified (name or permissions).
     * </p>
     *
     * @since v.0.1
     */
    ROLE_UPDATED,

    /**
     * Role deleted event.
     * <p>
     * Logged when a role is permanently deleted from the system.
     * </p>
     *
     * @since v.0.1
     */
    ROLE_DELETED,

    /**
     * Settings updated event.
     * <p>
     * Logged when system settings are updated.
     * </p>
     *
     * @since v.0.1
     */
    SETTINGS_UPDATED,

    /** A user was made a moderator of a guild (guild-scoped, E2.5). */
    MODERATOR_ADDED,

    /** A guild moderator was demoted back to respondent (guild-scoped, E2.5). */
    MODERATOR_REMOVED,

    /** The owner changed which forms a moderator works with (guild-scoped, #18). */
    MODERATOR_FORMS_CHANGED,

    /** A user was put on a guild's ban list (guild-scoped, E2.5). */
    GUILD_BAN_ADDED,

    /** A user was taken off a guild's ban list (guild-scoped, E2.5). */
    GUILD_BAN_REMOVED,

    /** The bot was installed on a guild and the installer became its owner (security audit, #103). */
    GUILD_CONNECTED,

    /**
     * Discord no longer confirms a member's OWNER/MODERATOR role (left the
     * server, or an owner lost Manage Server), so it was revoked (#103).
     */
    GUILD_ROLE_REVOKED,

    /** Published, closed or archived (metadata {@code from}, {@code to}). */
    FORM_STATUS_CHANGED,

    /** The bot was removed from the server or lost access to it. */
    BOT_REMOVED,

    /** The bot is back on the server. */
    BOT_RECONNECTED,

    /** The bot lost permissions it needs (metadata {@code permissions}). */
    BOT_PERMISSIONS_MISSING,

    /** A form's webhook stopped delivering (metadata {@code health}, {@code reason}). */
    WEBHOOK_FAILING,

    /** The bot created a webhook in a channel for a form (metadata {@code channel}, {@code formId}). */
    WEBHOOK_CREATED,

    /** The owner set the server's admin roles (metadata {@code from}, {@code to}: role names). */
    GUILD_ADMIN_ROLES_CHANGED,

    /** A member became an owner of the server through one of its admin roles. */
    GUILD_ROLE_GRANTED,

    /** The bot created the server's log category and channels. */
    GUILD_LOG_CHANNELS_CREATED,

    /** The owner changed the bot's nickname, avatar, banner or «Обо мне» on the server (metadata {@code changes}). */
    GUILD_BOT_PROFILE_CHANGED
}