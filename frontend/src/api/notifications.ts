import {apiRequest} from "./client";
import type {PageResponse} from "./dashboard";

export type NotificationType = "NEW_SUBMISSION" | "SUBMISSION_RESUBMITTED" | "WEBHOOK_PROBLEM" | "BOT_REMOVED";

/** An entry of the bell (#122); the text comes from the type and params. */
export interface AppNotification {
    id: string;
    type: NotificationType;
    guildId: string | null;
    targetId: string | null;
    params: Record<string, string>;
    /** Panel path to open. */
    link: string | null;
    createdAt: string;
    read: boolean;
}

export function getNotifications(size = 15): Promise<PageResponse<AppNotification>> {
    return apiRequest(`/me/notifications?size=${size}`);
}

export function getUnreadNotificationCount(): Promise<{ count: number }> {
    return apiRequest("/me/notifications/unread-count");
}

export function markNotificationRead(id: string): Promise<void> {
    return apiRequest(`/me/notifications/${id}/read`, {method: "POST"});
}

export function markAllNotificationsRead(): Promise<void> {
    return apiRequest("/me/notifications/read-all", {method: "POST"});
}
