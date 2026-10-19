import {apiRequest, downloadFile} from "./client";
import type {FormAccessMode, FormDefinition, FormStatus, WebhookConfig, WebhookHealth} from "../types/forms";

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
    /** Why that webhook fails (WebhookHealth reason code); null while notifications work. */
    notificationReason?: string | null;
    /** Submissions waiting for a decision (guild list only). */
    pendingCount?: number;
    /** Edits wait in the form's draft (ТЗ ФТ-5.6.2). */
    hasUnpublishedChanges?: boolean;
}

// ── Guild-scoped forms (owner panel) ───────────────────────────────────────

export function getGuildForms(guildId: string, includeArchived = false): Promise<PageResponse<DashboardForm>> {
    return apiRequest(`/guilds/${guildId}/forms?includeArchived=${includeArchived}&size=100`);
}

export interface CreateGuildFormPayload {
    schema: { title: string; description: string; reviewTime?: string | null; fields: unknown[] };
    channelsIds?: string[];
    webhooks?: WebhookConfig[];
    accessMode?: FormAccessMode;
    allowedRoleIds?: string[];
    deniedRoleIds?: string[];
    /** The address chosen in the wizard (ТЗ 5.2); generated on first publish when absent. */
    slug?: string;
}

export function createGuildForm(guildId: string, payload: CreateGuildFormPayload): Promise<FormDefinition> {
    return apiRequest(`/guilds/${guildId}/forms`, {method: "POST", body: payload});
}

export function getGuildForm(guildId: string, formId: string): Promise<FormDefinition> {
    return apiRequest(`/guilds/${guildId}/forms/${formId}`);
}

/** A new draft with the form's content: how an archived form comes back (ТЗ 4.4.2). */
export function copyGuildForm(guildId: string, formId: string): Promise<FormDefinition> {
    return apiRequest(`/guilds/${guildId}/forms/${formId}/copy`, {method: "POST"});
}

/** «Опубликовать изменения» (ТЗ ФТ-5.6.2): the draft goes live, the status stays. */
export function publishGuildFormChanges(guildId: string, formId: string): Promise<FormDefinition> {
    return apiRequest(`/guilds/${guildId}/forms/${formId}/publish-changes`, {method: "POST"});
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
    allowedRoleIds: string[];
    deniedRoleIds: string[];
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

export function updateRole(
    roleId: string,
    payload: { name?: string; color?: string; permissions?: string[] }
): Promise<DashboardRole> {
    return apiRequest(`/roles/${roleId}`, {method: "PUT", body: payload});
}

/** The bot's invite; with a server, straight to it («Выдать права», «Пригласить снова», #124). */
export function getGuildConnectUrl(guildId?: string): Promise<{ url: string }> {
    return apiRequest(guildId ? `/guilds/connect?guildId=${guildId}` : "/guilds/connect");
}

export type BotState = "CONNECTED" | "MISSING_PERMISSIONS" | "KICKED";

export interface MyGuild {
    guildId: string;
    guildName: string;
    botStatus: "CONNECTED" | "KICKED";
    role: "OWNER" | "MODERATOR" | "RESPONDENT";
    since: string;
    /* «Мои серверы» (#124); absent in older test data. */
    guildIconUrl?: string | null;
    memberCount?: number | null;
    botState?: BotState;
    /** VIEW_CHANNEL, MANAGE_WEBHOOKS the bot lacks. */
    missingPermissions?: string[];
    activeForms?: number;
    pendingSubmissions?: number;
}

export function getMyGuilds(): Promise<MyGuild[]> {
    return apiRequest("/me/guilds");
}

/** Re-reads the servers from Discord; once a minute (429 otherwise). */
export function refreshMyGuilds(): Promise<MyGuild[]> {
    return apiRequest("/me/guilds/refresh", {method: "POST"});
}

/** A member of a server's team (ТЗ 4.7.1): its owners first, then the moderators. */
export interface GuildModerator {
    discordId: string;
    username: string;
    avatarUrl?: string | null;
    role?: "OWNER" | "MODERATOR";
    /** When they became a moderator. */
    since: string;
    addedById?: string | null;
    addedByName?: string | null;
    /** Narrowed by the owner to {@link formIds} (#18); none chosen = no forms. */
    formsRestricted?: boolean;
    formIds?: string[];
}

export function getGuildModerators(guildId: string): Promise<GuildModerator[]> {
    return apiRequest(`/guilds/${guildId}/moderators`);
}

/** A server member found through the bot, for the moderator picker (ФТ-4.7.2). */
export interface MemberCandidate {
    discordId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    /** OWNER or MODERATOR if they already are one here. */
    role: "OWNER" | "MODERATOR" | null;
}

export function searchGuildMembers(guildId: string, q: string, signal?: AbortSignal): Promise<MemberCandidate[]> {
    return apiRequest(`/guilds/${guildId}/moderators/candidates?q=${encodeURIComponent(q)}`, {signal});
}

export function addGuildModerator(
    guildId: string,
    target: { discordId?: string; username?: string }
): Promise<GuildModerator> {
    return apiRequest(`/guilds/${guildId}/moderators`, {method: "POST", body: target});
}

/** All the server's forms, or only some (#18). */
export function setModeratorForms(
    guildId: string,
    discordId: string,
    payload: { restricted: boolean; formIds: string[] }
): Promise<GuildModerator> {
    return apiRequest(`/guilds/${guildId}/moderators/${discordId}/forms`, {method: "PUT", body: payload});
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
    /** When the ban ends; null = forever (#131). */
    expiresAt?: string | null;
}

export function getGuildBans(guildId: string): Promise<GuildBan[]> {
    return apiRequest(`/guilds/${guildId}/bans`);
}

export function banGuildUser(
    guildId: string,
    payload: { discordId?: string; username?: string; reason?: string; expiresAt?: string | null }
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

export interface DiscordRole {
    id: string;
    name: string;
    /** RGB colour as a number; 0 = no colour. */
    color: number;
    /** How many members MarForms knows to hold it (ТЗ ФТ-5.4.2). */
    memberCount?: number;
}

/** The guild's roles for the RoleGate picker, without @everyone. */
export function getGuildRoles(guildId: string): Promise<DiscordRole[]> {
    return apiRequest(`/guilds/${guildId}/roles`);
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

export interface UpdateFormPayload {
    schema?: { title: string; description: string; reviewTime?: string | null; fields: unknown[] };
    webhooks?: WebhookConfig[];
    channelsIds?: string[];
    active?: boolean;
    /** Access settings, saved in the same transaction as the rest. */
    settings?: FormSettingsPayload;
    /** The version this edit is based on; the server answers 409 if the form moved on. */
    version?: number;
    /** A new address (ТЗ 5.2): the old link stops working. */
    slug?: string;
}

/** The editor's save, through the form's server (#103: one API for forms). */
export function updateForm(
    guildId: string,
    formId: string,
    payload: UpdateFormPayload
): Promise<import("../types/forms").FormDefinition> {
    return apiRequest(`/guilds/${guildId}/forms/${formId}`, {method: "PUT", body: payload});
}


export interface DashboardRole {
    id: string;
    name: string;
    /** Chip colour, #RRGGBB. */
    color?: string | null;
    permissions: string[];
    /** The system role: it can't be deleted or lose SYSTEM_ADMIN (ТЗ 2.3). */
    system?: boolean;
    /** How many users hold it. */
    users?: number;
}

export function getRoles(): Promise<DashboardRole[]> {
    return apiRequest("/roles");
}

export function createRole(payload: {
    name: string;
    color?: string;
    permissions?: string[];
    /** Start with this role's rights («Скопировать права из», ТЗ 6.4). */
    copyFrom?: string;
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

/** Downloads a form's submissions as CSV (owner only, E3.3). */
export function exportFormCsv(formId: string): Promise<void> {
    return downloadFile(`/forms/${formId}/export?format=csv`, "submissions.csv");
}

export type PlanMetric = "ACTIVE_FORMS" | "SUBMISSIONS_PER_MONTH" | "MODERATORS" | "FILE_STORAGE";

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
