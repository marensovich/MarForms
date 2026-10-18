import {apiRequest} from "./client";

// «Платформа → Система» (ТЗ 6.6, #147).

export interface SystemInfo {
    cpu: { usage: number; cores: number; loadAverage: number[] };
    /** Bytes. */
    ram: { used: number; total: number; heapUsed: number; heapMax: number };
    /** Bytes; database is null when it can't be read. */
    disk: { used: number; total: number; uploads: number; database: number | null };
    about: { os: string; jvm: string; version: string; commit: string | null; uptimeSeconds: number };
    jobs: { queued: number; failed: number; succeeded24h: number };
    webhooks: { healthy: number; degraded: number; invalid: number };
    at: string;
}

export interface Updates {
    current: string;
    latest: string | null;
    available: boolean;
    notes: string | null;
    url: string | null;
    checkedAt: string;
    error: string | null;
}

export function fetchSystemInfo(): Promise<SystemInfo> {
    return apiRequest<SystemInfo>("/system/info");
}

export function fetchUpdates(): Promise<Updates> {
    return apiRequest<Updates>("/system/updates");
}

export function checkUpdates(): Promise<Updates> {
    return apiRequest<Updates>("/system/check-updates", {method: "POST"});
}
