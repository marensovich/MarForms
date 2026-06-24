import {apiRequest} from "./client";

export interface SystemInfo {
    cpuUsage: number;
    ramUsed: number;
    ramTotal: number;
    diskUsed: number;
    diskTotal: number;
    uptimeSeconds: number;
    osName: string;
    osVersion: string;
    jvmVersion: string;
    appVersion: string;
}

export function fetchSystemInfo(): Promise<SystemInfo> {
    return apiRequest<SystemInfo>("/system/info");
}
