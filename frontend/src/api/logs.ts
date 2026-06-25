import {apiRequest} from "./client";
import type {AuditAction, AuditLogPage} from "../types/logs";

export function getAuditLogs(
    page = 0,
    size = 25,
    action?: AuditAction,
    actorDiscordId?: string
): Promise<AuditLogPage> {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    if (action) params.set("action", action);
    if (actorDiscordId) params.set("actorDiscordId", actorDiscordId);
    return apiRequest<AuditLogPage>(`/admin/logs?${params}`);
}
