export interface AuthUser {
    id: string;
    discordUsername: string;
    avatarUrl: string | null;
    role: string;
    guildIds: string[];
    permissions: string[];
    permissionsHash: string;
}

export interface JwtPayload {
    userId: number;
    sub?: string;
    role?: string;
    guildIds?: string[];
    iat: number;
    exp: number;
}