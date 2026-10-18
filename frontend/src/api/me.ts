import {apiRequest} from "./client";

export interface MeResponse {
    discordId: string;
    discordUsername: string;
    roles: string[];
    permissions: string[];
    permissionsHash: string;
    /** A platform time-out in force (ТЗ 6.3): the panel is closed until it ends. */
    timeout?: { until: string; reason: string | null } | null;
}

export function fetchMe(): Promise<MeResponse> {
    return apiRequest<MeResponse>("/me");
}