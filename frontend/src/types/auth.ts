export interface AuthUser {
    id: string;
    discordUsername: string;
    avatarUrl: string | null;
    role: string;
    guildIds: string[];
    permissions: string[];
    permissionsHash: string;
    /** A platform time-out in force (ТЗ 6.3): the panel is closed until it ends. */
    timeout?: { until: string; reason: string | null } | null;
}

export interface JwtPayload {
    userId: number;
    sub?: string;
    role?: string;
    guildIds?: string[];
    iat: number;
    exp: number;
}