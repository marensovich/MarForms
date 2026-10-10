import {apiRequest, downloadFile} from "./client";
import type {FormAccessMode, FormAnswers, FormDefinition, FormStatus, WebhookConfig, WebhookHealth} from "../types/forms";

export interface DashboardForm {
    id: string;
    title: string;
    active: boolean;
    submissionCount: number;
    createdAt: string;
    serverId?: string;
    status?: FormStatus;
    accessMode?: FormAccessMode;
    slug?: string | null;
    fieldCount?: number;
    updatedAt?: string;
    /** Worst status among the form's webhooks; null if it has none. */
    notificationHealth?: WebhookHealth | null;
}

// ── Guild-scoped forms (owner panel) ───────────────────────────────────────

export function getGuildForms(guildId: string, includeArchived = false): Promise<PageResponse<DashboardForm>> {
    return apiRequest(`/guilds/${guildId}/forms?includeArchived=${includeArchived}&size=100`);
}

export interface CreateGuildFormPayload {
    schema: { title: string; description: string; fields: unknown[] };
    channelsIds?: string[];
    webhooks?: WebhookConfig[];
    accessMode?: FormAccessMode;
}

export function createGuildForm(guildId: string, payload: CreateGuildFormPayload): Promise<FormDefinition> {
    return apiRequest(`/guilds/${guildId}/forms`, {method: "POST", body: payload});
}

export function publishGuildForm(guildId: string, formId: string): Promise<FormDefinition> {
    return apiRequest(`/guilds/${guildId}/forms/${formId}/publish`, {method: "POST"});
}

export function setGuildFormStatus(guildId: string, formId: string, status: FormStatus): Promise<FormDefinition> {
    return apiRequest(`/guilds/${guildId}/forms/${formId}/status`, {method: "PUT", body: {status}});
}

export interface FormSettingsPayload {
    accessMode: FormAccessMode;
    submissionLimitPerUser: number | null;
    opensAt: string | null;
    closesAt: string | null;
}

export function updateGuildFormSettings(
    guildId: string,
    formId: string,
    payload: FormSettingsPayload
): Promise<FormDefinition> {
    return apiRequest(`/guilds/${guildId}/forms/${formId}/settings`, {method: "PUT", body: payload});
}

export function deleteGuildForm(guildId: string, formId: string): Promise<void> {
    return apiRequest(`/guilds/${guildId}/forms/${formId}`, {method: "DELETE"});
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

export interface GuildBan {
    discordId: string;
    username: string | null;
    reason: string | null;
    bannedBy: string | null;
    bannedByUsername: string | null;
    createdAt: string;
}

export function getGuildBans(guildId: string): Promise<GuildBan[]> {
    return apiRequest(`/guilds/${guildId}/bans`);
}

export function banGuildUser(
    guildId: string,
    payload: { discordId?: string; username?: string; reason?: string }
): Promise<GuildBan> {
    return apiRequest(`/guilds/${guildId}/bans`, {method: "POST", body: payload});
}

export function unbanGuildUser(guildId: string, discordId: string): Promise<void> {
    return apiRequest(`/guilds/${guildId}/bans/${discordId}`, {method: "DELETE"});
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
/** Downloads a form's submissions as CSV (owner only, E3.3). */
export function exportFormCsv(formId: string): Promise<void> {
    return downloadFile(`/forms/${formId}/export?format=csv`, "submissions.csv");
}

export type PlanMetric = "ACTIVE_FORMS" | "SUBMISSIONS_PER_MONTH" | "MODERATORS";

export interface GuildUsage {
    plan: string;
    usage: { metric: PlanMetric; used: number; limit: number | null }[];
}

/** A guild's plan and its usage against each limit (owner only, E4.1). */
export function getGuildUsage(guildId: string): Promise<GuildUsage> {
    return apiRequest(`/guilds/${guildId}/usage`);
}

export interface BillingStatus {
    workspaceId: string;
    guildCount: number;
    guilds: { guildId: string; name: string }[];
    plan: string;
    /** Stripe's subscription status, "none" if never subscribed */
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    billingEnabled: boolean;
    availablePlans: string[];
}

export function getGuildBilling(guildId: string): Promise<BillingStatus> {
    return apiRequest(`/guilds/${guildId}/billing`);
}

/** Starts Stripe Checkout; returns the URL to send the owner to. */
export function startCheckout(guildId: string, plan: string): Promise<{ url: string }> {
    return apiRequest(`/guilds/${guildId}/billing/checkout`, {method: "POST", body: {plan}});
}

/** Opens the Stripe Billing Portal; returns its URL. */
export function openBillingPortal(guildId: string): Promise<{ url: string }> {
    return apiRequest(`/guilds/${guildId}/billing/portal`, {method: "POST"});
}

/** Puts a server under another server's subscription (E4.3); the caller owns both. */
export function joinWorkspace(guildId: string, targetGuildId: string): Promise<BillingStatus> {
    return apiRequest(`/guilds/${guildId}/workspace/join`, {method: "POST", body: {targetGuildId}});
}

/** Takes a server out of a shared subscription, back to the free plan. */
export function leaveWorkspace(guildId: string): Promise<BillingStatus> {
    return apiRequest(`/guilds/${guildId}/workspace/leave`, {method: "POST"});
}
