import {API, apiRequest} from "./client";

export interface PublicSettings {
    banMessage: string;
    banAdminContact: string;
    systemName: string;
    /** Support contact, shown on the sign-in and public pages. */
    systemContact: string;
    uiLanguage: string;
}

export interface SystemSettings extends PublicSettings {
    logWebhookUrl: string;
    logEnabledActions: string;
    globalEmbedColor: string;
    globalEmbedTitle: string;
    globalEmbedDescription: string;
    globalEmbedAuthorName: string;
    globalEmbedAuthorIcon: string;
    globalEmbedAuthorUrl: string;
    globalEmbedThumbnail: string;
    globalEmbedImage: string;
    globalEmbedFooterText: string;
    globalEmbedFooterIcon: string;
    uiLanguage: string;
}

export function fetchPublicSettings(): Promise<PublicSettings> {
    return fetch(`${API}/api/v1/settings/public`)
        .then(r => r.json());
}

export function fetchSettings(): Promise<SystemSettings> {
    return apiRequest<SystemSettings>("/settings");
}

export function updateSettings(payload: Partial<SystemSettings>): Promise<SystemSettings> {
    return apiRequest<SystemSettings>("/settings", {
        method: "PUT",
        body: {
            "ban.message": payload.banMessage,
            "ban.admin.contact": payload.banAdminContact,
            "system.name": payload.systemName,
            "system.contact": payload.systemContact,
            "log.webhook.url": payload.logWebhookUrl,
            "log.enabled.actions": payload.logEnabledActions,
            "global.embed.color": payload.globalEmbedColor,
            "global.embed.title": payload.globalEmbedTitle,
            "global.embed.description": payload.globalEmbedDescription,
            "global.embed.author.name": payload.globalEmbedAuthorName,
            "global.embed.author.icon": payload.globalEmbedAuthorIcon,
            "global.embed.author.url": payload.globalEmbedAuthorUrl,
            "global.embed.thumbnail": payload.globalEmbedThumbnail,
            "global.embed.image": payload.globalEmbedImage,
            "global.embed.footer.text": payload.globalEmbedFooterText,
            "global.embed.footer.icon": payload.globalEmbedFooterIcon,
            "ui.language": payload.uiLanguage,
        },
    });
}

/** How the journal webhook last answered (ТЗ 6.7). */
export interface LogDelivery {
    ok: boolean;
    /** The HTTP status, or why it failed. */
    status: string;
    at: string;
}

export function fetchLogWebhook(): Promise<{ configured: boolean; lastDelivery: LogDelivery | null }> {
    return apiRequest("/settings/log-webhook");
}

/** «Отправить тест»: to the URL being edited, or the saved one. */
export function testLogWebhook(url?: string): Promise<LogDelivery> {
    return apiRequest("/settings/log-webhook/test", {method: "POST", body: {url: url ?? ""}});
}

/** The bot's status (2026-10-19): one for every server. */
export interface BotPresence {
    status: string;
    activity: string;
    text: string;
}

export function getBotPresence(): Promise<BotPresence> {
    return apiRequest("/settings/bot-presence");
}

export function setBotPresence(presence: BotPresence): Promise<BotPresence> {
    return apiRequest("/settings/bot-presence", {method: "PUT", body: presence});
}
