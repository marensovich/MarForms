import {apiRequest} from "./client";

export interface MeResponse {
    discordId: string;
    discordUsername: string;
    roles: string[];
    permissions: string[];
    permissionsHash: string;
}

export function fetchMe(): Promise<MeResponse> {
    return apiRequest<MeResponse>("/me");
}