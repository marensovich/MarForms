import {apiRequest} from "./client";

export interface PublicSettings {
    banMessage: string;
    banAdminContact: string;
    systemName: string;
}

export interface SystemSettings extends PublicSettings {
    systemContact: string;
}

export function fetchPublicSettings(): Promise<PublicSettings> {
    return fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8090"}/api/v1/settings/public`)
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
        },
    });
}