import {apiRequest} from "./client";
import type {FormStatus} from "../types/forms";
import type {SubmissionStatus} from "./moderation";

// GET /api/v1/search — the ⌘K palette (#107). `workspace` = the caller is staff of the
// server, so the hit opens in the server workspace rather than the admin section.

export interface FormHit {
    id: string;
    title: string;
    slug: string | null;
    status: FormStatus;
    guildId: string | null;
    guildName: string | null;
    workspace: boolean;
}

export interface SubmissionHit {
    id: string;
    formId: string;
    formTitle: string | null;
    guildId: string | null;
    guildName: string | null;
    authorDiscordId: string | null;
    authorName: string | null;
    status: SubmissionStatus;
    createdAt: string;
    workspace: boolean;
}

export interface UserHit {
    discordId: string;
    username: string;
    avatarUrl: string | null;
}

export interface SearchResults {
    forms: FormHit[];
    submissions: SubmissionHit[];
    users: UserHit[];
}

export function search(q: string, signal?: AbortSignal): Promise<SearchResults> {
    return apiRequest(`/search?q=${encodeURIComponent(q)}`, {signal});
}
