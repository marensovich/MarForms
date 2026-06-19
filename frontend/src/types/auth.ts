export type UserRole = "USER" | "MODERATOR" | "ADMIN";

export interface AuthUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: UserRole;
  guildIds: string[];
}

export interface JwtPayload {
  userId: number;
  sub?: string;
  role?: UserRole;
  guildIds?: string[];
  iat: number;
  exp: number;
}