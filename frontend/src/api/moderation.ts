import {apiRequest, downloadFile} from "./client";
import type {PageResponse} from "./dashboard";
import type {FormAnswers, FormSchema} from "../types/forms";

/** RECEIVED: sent to a form without review on the site — it only went to Discord (2026-10-19). */
export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVISION" | "RECEIVED";

export type DecisionStatus = Exclude<SubmissionStatus, "PENDING" | "RECEIVED">;

export interface ModerationSubmission {
    id: string;
    formId: string;
    discordId: string | null;
    createdAt: string;
    answers: FormAnswers;
    status: SubmissionStatus;
    moderatorDiscordId: string | null;
    moderatorComment: string | null;
    decidedAt: string | null;
    discordUsername: string | null;
    formTitle: string | null;
    /** Who decided (#118). */
    moderatorUsername?: string | null;
    /** Short number on the server («Заявка #1043»); null for old submissions. */
    number?: number | null;
}

export type SubmissionEventType = "SUBMITTED" | "DECIDED" | "REOPENED" | "RESUBMITTED";

/** A step of a submission's history (#118). */
export interface SubmissionEvent {
    type: SubmissionEventType;
    from: SubmissionStatus | null;
    to: SubmissionStatus;
    actorName: string | null;
    comment: string | null;
    at: string;
}

export interface DiscordRoleInfo {
    id: string;
    name: string | null;
    /** 0xRRGGBB; 0 or 0x1FFFFFFF = no colour */
    color: number;
}

export interface SubmissionAuthor {
    discordId: string;
    username: string | null;
    avatarUrl: string | null;
    discordRoles: DiscordRoleInfo[];
    rolesSyncedAt: string | null;
    submissionCount: number;
}

export interface SubmissionDetail {
    submission: ModerationSubmission;
    formId: string;
    schema: FormSchema;
    author: SubmissionAuthor | null;
    files?: SubmissionFile[];
    history: SubmissionEvent[];
}

export interface ModerationFilters {
    formId?: string;
    status?: SubmissionStatus;
    query?: string;
    /** Who decided (Discord ID). */
    moderator?: string;
    page?: number;
    size?: number;
}

export function getGuildSubmissions(
    guildId: string,
    filters: ModerationFilters
): Promise<PageResponse<ModerationSubmission>> {
    const p = new URLSearchParams({
        page: String(filters.page ?? 0),
        size: String(filters.size ?? 20),
    });
    if (filters.formId) p.set("formId", filters.formId);
    if (filters.status) p.set("status", filters.status);
    if (filters.query) p.set("query", filters.query);
    if (filters.moderator) p.set("moderator", filters.moderator);
    return apiRequest(`/guilds/${guildId}/submissions?${p}`);
}

export function getSubmissionDetail(id: string): Promise<SubmissionDetail> {
    return apiRequest(`/submissions/${id}`);
}

export function decideSubmission(
    id: string,
    /** PENDING reopens an approved or rejected decision (owner only). */
    status: DecisionStatus | "PENDING",
    comment?: string,
    /** The status on screen: the server refuses (409) if another moderator decided since. */
    expectedStatus?: string
): Promise<ModerationSubmission> {
    return apiRequest(`/submissions/${id}/decision`, {
        method: "POST",
        body: {status, comment: comment?.trim() || null, expectedStatus: expectedStatus ?? null},
    });
}

/** A respondent's own submission (ТЗ 3.6). */
export interface MySubmission {
    id: string;
    /** Short number on the server ("№ 1048"). */
    number: number | null;
    formId: string;
    formTitle: string | null;
    formSlug: string | null;
    guildId: string | null;
    guildName: string | null;
    guildIconUrl: string | null;
    status: SubmissionStatus;
    moderatorComment: string | null;
    /** Who decided, if anyone has. */
    moderatorName: string | null;
    createdAt: string;
    decidedAt: string | null;
}

/** «Все · На рассмотрении · С решением» (ТЗ ФТ-3.6.2). */
export type MySubmissionSegment = "all" | "pending" | "decided";

export function getMySubmissions(page = 0, size = 20, segment: MySubmissionSegment = "all"): Promise<PageResponse<MySubmission>> {
    const status = segment === "all" ? "" : `&status=${segment}`;
    return apiRequest(`/me/submissions?page=${page}&size=${size}${status}`);
}

export function getMySubmissionCounts(): Promise<Record<MySubmissionSegment, number>> {
    return apiRequest("/me/submissions/counts");
}

export interface MySubmissionDetail {
    submission: MySubmission;
    /** The questions it answered (its snapshot). */
    schema: FormSchema | null;
    answers: FormAnswers;
    files: SubmissionFile[];
    history: SubmissionEvent[];
}

export function getMySubmission(id: string): Promise<MySubmissionDetail> {
    return apiRequest(`/me/submissions/${id}`);
}

/** Sends a submission again after revision (#119); it goes back to pending. */
export function resubmitMySubmission(id: string, answers: FormAnswers): Promise<{ id: string; number: number | null; status: SubmissionStatus; createdAt: string }> {
    return apiRequest(`/me/submissions/${id}/resubmit`, {method: "POST", body: {answers}});
}

export type GuildAuditAction =
    | "SUBMISSION_DECIDED"
    | "SUBMISSION_DM_FAILED"
    | "MODERATOR_ADDED"
    | "MODERATOR_REMOVED"
    | "MODERATOR_FORMS_CHANGED"
    | "GUILD_BAN_ADDED"
    | "GUILD_BAN_REMOVED"
    | "GUILD_CONNECTED"
    | "GUILD_ROLE_REVOKED"
    | "SUBMISSION_DELETED"
    | "FORM_CREATED"
    | "FORM_UPDATED"
    | "FORM_STATUS_CHANGED"
    | "FORM_DELETED"
    | "BOT_REMOVED"
    | "BOT_RECONNECTED"
    | "BOT_PERMISSIONS_MISSING"
    | "WEBHOOK_FAILING"
    | "WEBHOOK_CREATED"
    | "GUILD_ADMIN_ROLES_CHANGED"
    | "GUILD_ROLE_GRANTED"
    | "GUILD_LOG_CHANNELS_CREATED"
    | "GUILD_BOT_PROFILE_CHANGED";

export interface GuildAuditEntry {
    id: string;
    action: GuildAuditAction;
    actorDiscordId: string | null;
    actorUsername: string | null;
    targetType: string | null;
    targetId: string | null;
    targetName: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    /** The last of back-to-back edits merged into this entry (2026-10-19). */
    lastAt?: string | null;
}

/** A page of a server's journal: `nextCursor` continues it, null at the end (ТЗ 4.6.2). */
export interface GuildAuditFeed {
    items: GuildAuditEntry[];
    nextCursor: string | null;
}

export function getGuildAuditLog(
    guildId: string,
    filters: { actions?: GuildAuditAction[]; actorId?: string; days?: number; cursor?: string | null; size?: number }
): Promise<GuildAuditFeed> {
    const p = new URLSearchParams({size: String(filters.size ?? 30)});
    filters.actions?.forEach(a => p.append("action", a));
    if (filters.actorId) p.set("actorId", filters.actorId);
    if (filters.days) p.set("days", String(filters.days));
    if (filters.cursor) p.set("cursor", filters.cursor);
    return apiRequest(`/guilds/${guildId}/audit-log?${p}`);
}

/** Who has acted in a server's journal, for its «Кто» filter. */
export function getGuildAuditActors(guildId: string): Promise<{ discordId: string; username: string | null }[]> {
    return apiRequest(`/guilds/${guildId}/audit-log/actors`);
}

export interface SubmissionFile {
    id: string;
    fieldId: string;
    name: string;
    contentType: string | null;
    size: number;
}

/** Downloads an attachment (moderators only). */
export function downloadSubmissionFile(file: SubmissionFile): Promise<void> {
    return downloadFile(`/files/${file.id}`, file.name);
}
