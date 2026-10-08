import {apiRequest} from "./client";
import type {FormAnswers, WebhookConfig} from "../types/forms";

export interface DashboardForm {
    id: string;
    title: string;
    active: boolean;
    submissionCount: number;
    createdAt: string;
}

export interface DashboardUser {
    id: number;
    discordId: string;
    discordUsername: string;
    roles: DashboardRole[];
    bannedPermanently: boolean;
    bannedUntil: string | null;
    currentlyBanned: boolean;
}

export function getUsers(
    page = 0,
    size = 20,
    search?: string,
    roleId?: string
): Promise<PageResponse<DashboardUser>> {
    const params = new URLSearchParams({
        page: String(page),
        size: String(size),
        ...(search ? {search} : {}),
        ...(roleId ? {roleId} : {}),
    });
    return apiRequest(`/admin/users?${params}`);
}

export function updateRole(
    roleId: string,
    payload: { name?: string; permissions?: string[] }
): Promise<DashboardRole> {
    return apiRequest(`/roles/${roleId}`, {method: "PUT", body: payload});
}

export interface CreateFormPayload {
    serverId: string;
    channelsIds?: string[];
    webhooks?: WebhookConfig[];
    schema: {
        title: string;
        description: string;
        fields: unknown[];
    };
}

export function getDashboardForms(page = 0, size = 20): Promise<PageResponse<DashboardForm>> {
    return apiRequest(`/forms?page=${page}&size=${size}`);
}

export function createForm(payload: CreateFormPayload): Promise<DashboardForm> {
    return apiRequest("/forms", {method: "POST", body: payload});
}

export function getGuildConnectUrl(): Promise<{ url: string }> {
    return apiRequest("/guilds/connect");
}

export interface MyGuild {
    guildId: string;
    guildName: string;
    botStatus: "CONNECTED" | "KICKED";
    role: "OWNER" | "MODERATOR" | "RESPONDENT";
    since: string;
}

export function getMyGuilds(): Promise<MyGuild[]> {
    return apiRequest("/me/guilds");
}

export interface GuildModerator {
    discordId: string;
    username: string;
    since: string;
}

export function getGuildModerators(guildId: string): Promise<GuildModerator[]> {
    return apiRequest(`/guilds/${guildId}/moderators`);
}

export function addGuildModerator(
    guildId: string,
    target: { discordId?: string; username?: string }
): Promise<GuildModerator> {
    return apiRequest(`/guilds/${guildId}/moderators`, {method: "POST", body: target});
}

export function removeGuildModerator(guildId: string, discordId: string): Promise<void> {
    return apiRequest(`/guilds/${guildId}/moderators/${discordId}`, {method: "DELETE"});
}

export interface DiscordChannel {
    id: string;
    name: string;
}

export function getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    return apiRequest(`/guilds/${guildId}/channels`);
}

export function createGuildWebhook(
    guildId: string,
    channelId: string,
    name?: string
): Promise<{ url: string }> {
    return apiRequest(`/guilds/${guildId}/channels/${channelId}/webhooks`, {
        method: "POST",
        body: name ? {name} : {},
    });
}

export function toggleFormActive(formId: string, active: boolean): Promise<DashboardForm> {
    return apiRequest(`/forms/${formId}`, {method: "PUT", body: {active}});
}

export interface UpdateFormPayload {
    schema?: { title: string; description: string; fields: unknown[] };
    webhooks?: WebhookConfig[];
    channelsIds?: string[];
    active?: boolean;
}

export function updateForm(
    formId: string,
    payload: UpdateFormPayload
): Promise<import("../types/forms").FormDefinition> {
    return apiRequest(`/forms/${formId}`, {method: "PUT", body: payload});
}

export function deleteForm(formId: string): Promise<void> {
    return apiRequest(`/forms/${formId}`, {method: "DELETE"});
}

export interface DashboardSubmission {
    id: string;
    formId: string;
    discordId: string;
    createdAt: string;
    answers: FormAnswers;
}

export function getFormSubmissions(
    formId: string,
    page = 0,
    size = 20
): Promise<PageResponse<DashboardSubmission>> {
    return apiRequest(`/forms/${formId}/submissions?page=${page}&size=${size}`);
}


export function assignUserRoles(discordId: string, roleIds: string[]): Promise<DashboardUser> {
    return apiRequest(`/admin/users/${discordId}/roles`, {
        method: "PUT",
        body: {roleIds},
    });
}

export function banUser(
    discordId: string,
    payload: { permanent: boolean; timeoutMinutes?: number }
): Promise<DashboardUser> {
    return apiRequest(`/admin/users/${discordId}/ban`, {
        method: "POST",
        body: payload,
    });
}

export function unbanUser(discordId: string): Promise<DashboardUser> {
    return apiRequest(`/admin/users/${discordId}/unban`, {method: "POST"});
}

export interface DashboardRole {
    id: string;
    name: string;
    permissions: string[];
}

export function getRoles(): Promise<DashboardRole[]> {
    return apiRequest("/roles");
}

export function createRole(payload: {
    name: string;
    permissions: string[];
}): Promise<DashboardRole> {
    return apiRequest("/roles", {method: "POST", body: payload});
}

export function deleteRole(roleId: string): Promise<void> {
    return apiRequest(`/roles/${roleId}`, {method: "DELETE"});
}

export interface PageResponse<T> {
    content: T[];
    page: {
        totalElements: number;
        totalPages: number;
        number: number;
        size: number;
    };
}

export function getForm(formId: string): Promise<import("../types/forms").FormDefinition> {
    return apiRequest(`/forms/${formId}`);
}

export interface UserSubmissionCount {
    discordId: string;
    count: number;
}

export function getAllSubmissions(params: {
    formId?: string;
    search?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortDir?: string;
}): Promise<PageResponse<DashboardSubmission>> {
    const p = new URLSearchParams({
        page: String(params.page ?? 0),
        size: String(params.size ?? 15),
        sortBy: params.sortBy ?? "createdAt",
        sortDir: params.sortDir ?? "DESC",
    });
    if (params.formId) p.set("formId", params.formId);
    if (params.search) p.set("search", params.search);
    return apiRequest(`/admin/submissions?${p}`);
}

export function getUserSubmissionCounts(): Promise<UserSubmissionCount[]> {
    return apiRequest("/admin/submissions/by-user");
}

export function deleteSubmission(id: string): Promise<void> {
    return apiRequest(`/admin/submissions/${id}`, {method: "DELETE"});
}