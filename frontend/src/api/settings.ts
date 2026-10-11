import {API, apiRequest} from "./client";

export interface PublicSettings {
    banMessage: string;
    banAdminContact: string;
    systemName: string;
    uiLanguage: string;
}

export interface SystemSettings extends PublicSettings {
    systemContact: string;
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