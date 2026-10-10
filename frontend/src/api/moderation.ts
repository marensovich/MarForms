import {apiRequest} from "./client";
import type {PageResponse} from "./dashboard";
import type {FormAnswers, FormSchema} from "../types/forms";

export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVISION";

export type DecisionStatus = Exclude<SubmissionStatus, "PENDING">;

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
}

export interface ModerationFilters {
    formId?: string;
    status?: SubmissionStatus;
    query?: string;
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
    return apiRequest(`/guilds/${guildId}/submissions?${p}`);
}

export function getSubmissionDetail(id: string): Promise<SubmissionDetail> {
    return apiRequest(`/submissions/${id}`);
}

export function decideSubmission(
    id: string,
    status: DecisionStatus,
    comment?: string
): Promise<ModerationSubmission> {
    return apiRequest(`/submissions/${id}/decision`, {
        method: "POST",
        body: {status, comment: comment?.trim() || null},
    });
}

export interface MySubmission {
    id: string;
    formId: string;
    formTitle: string | null;
    status: SubmissionStatus;
    moderatorComment: string | null;
    createdAt: string;
    decidedAt: string | null;
}

export function getMySubmissions(page = 0, size = 20): Promise<PageResponse<MySubmission>> {
    return apiRequest(`/me/submissions?page=${page}&size=${size}`);
}
