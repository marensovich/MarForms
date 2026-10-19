export type AuditAction =
    | "USER_LOGIN"
    | "USER_BANNED"
    | "USER_UNBANNED"
    | "USER_TIMED_OUT"
    | "USER_TIMEOUT_LIFTED"
    | "USER_ROLES_UPDATED"
    | "FORM_CREATED"
    | "FORM_UPDATED"
    | "FORM_DELETED"
    | "SUBMISSION_CREATED"
    | "SUBMISSION_DELETED"
    | "SUBMISSION_DECIDED"
    | "SUBMISSION_DM_FAILED"
    | "ROLE_CREATED"
    | "ROLE_UPDATED"
    | "ROLE_DELETED"
    | "SETTINGS_UPDATED"
    | "MODERATOR_ADDED"
    | "MODERATOR_REMOVED"
    | "MODERATOR_FORMS_CHANGED"
    | "GUILD_BAN_ADDED"
    | "GUILD_BAN_REMOVED"
    | "GUILD_CONNECTED"
    | "GUILD_ROLE_REVOKED"
    | "FORM_STATUS_CHANGED"
    | "BOT_REMOVED"
    | "BOT_RECONNECTED"
    | "BOT_PERMISSIONS_MISSING"
    | "WEBHOOK_FAILING"
    | "WEBHOOK_CREATED"
    | "GUILD_ADMIN_ROLES_CHANGED"
    | "GUILD_ROLE_GRANTED"
    | "GUILD_LOG_CHANNELS_CREATED";

/** A field a change changed (ТЗ 6.5): before and after, secrets masked. */
export interface AuditChange {
    field: string;
    before: string | null;
    after: string | null;
}

export interface AuditLogEntry {
    id: string;
    action: AuditAction;
    actorDiscordId: string | null;
    actorUsername: string | null;
    actorAvatarUrl: string | null;
    targetId: string | null;
    targetName: string | null;
    targetType: string | null;
    guildId: string | null;
    details: string | null;
    diff: AuditChange[];
    /** The last of back-to-back edits merged into this entry (2026-10-19). */
    lastAt?: string | null;
    createdAt: string;
}
