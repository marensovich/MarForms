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
    | "GUILD_BAN_ADDED"
    | "GUILD_BAN_REMOVED"
    | "GUILD_CONNECTED"
    | "GUILD_ROLE_REVOKED"
    | "FORM_STATUS_CHANGED"
    | "BOT_REMOVED"
    | "BOT_RECONNECTED"
    | "BOT_PERMISSIONS_MISSING"
    | "WEBHOOK_FAILING";

export interface AuditLogEntry {
    id: string;
    action: AuditAction;
    actorDiscordId: string | null;
    actorUsername: string | null;
    targetId: string | null;
    targetName: string | null;
    details: string | null;
    createdAt: string;
}

export interface AuditLogPage {
    content: AuditLogEntry[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}
