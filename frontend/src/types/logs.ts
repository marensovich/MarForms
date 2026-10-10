export type AuditAction =
    | "USER_LOGIN"
    | "USER_BANNED"
    | "USER_UNBANNED"
    | "USER_ROLES_UPDATED"
    | "FORM_CREATED"
    | "FORM_UPDATED"
    | "FORM_DELETED"
    | "SUBMISSION_CREATED"
    | "SUBMISSION_DELETED"
    | "SUBMISSION_DECIDED"
    | "ROLE_CREATED"
    | "ROLE_UPDATED"
    | "ROLE_DELETED"
    | "SETTINGS_UPDATED"
    | "MODERATOR_ADDED"
    | "MODERATOR_REMOVED"
    | "GUILD_BAN_ADDED"
    | "GUILD_BAN_REMOVED";

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
