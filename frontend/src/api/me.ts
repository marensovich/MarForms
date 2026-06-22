import {apiRequest} from "./client";

export interface MeResponse {
    discordId: number;
    discordUsername: string;
    roles: string[];
    permissions: string[];
}

export function fetchMe(): Promise<MeResponse> {
    return apiRequest<MeResponse>("/me");
}