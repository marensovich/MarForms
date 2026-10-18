import {apiRequest} from "./client";
import type {PageResponse} from "./dashboard";

// The platform's users (ТЗ 6.3, #144).

export type UserStatus = "ACTIVE" | "TIMEOUT" | "BANNED";

export interface RoleChip {
    id: string;
    name: string;
    color: string | null;
}

export interface PlatformUser {
    discordId: string;
    username: string;
    avatarUrl: string | null;
    roles: RoleChip[];
    status: UserStatus;
    /** End of a time-out (local ISO). */
    until: string | null;
    reason: string | null;
    lastSeenAt: string | null;
    /** The caller stands no higher than this user (ТЗ 2.3): no ban, time-out or taking roles. */
    outranked: boolean;
    self: boolean;
}

export interface UserStats {
    total: number;
    lastWeek: number;
    active30: number;
    banned: number;
    timedOut: number;
}

export interface Restriction {
    type: "BAN" | "TIMEOUT";
    reason: string | null;
    endsAt: string | null;
    createdAt: string;
    createdBy: string | null;
    createdByName: string | null;
    liftedAt: string | null;
    liftedByName: string | null;
}

export interface UserFilters {
    q?: string;
    roleId?: string;
    status?: "active" | "timeout" | "banned";
    page?: number;
    size?: number;
}

export function getPlatformUsers(f: UserFilters): Promise<PageResponse<PlatformUser>> {
    const p = new URLSearchParams({page: String(f.page ?? 0), size: String(f.size ?? 25)});
    if (f.q) p.set("q", f.q);
    if (f.roleId) p.set("roleId", f.roleId);
    if (f.status) p.set("status", f.status);
    return apiRequest(`/admin/users?${p}`);
}

export function getUserStats(): Promise<UserStats> {
    return apiRequest("/admin/users/stats");
}

export function getRestrictions(discordId: string): Promise<Restriction[]> {
    return apiRequest(`/admin/users/${discordId}/restrictions`);
}

export function assignUserRoles(discordId: string, roleIds: string[]): Promise<PlatformUser> {
    return apiRequest(`/admin/users/${discordId}/roles`, {method: "PUT", body: {roleIds}});
}

export function banUser(discordId: string, reason: string): Promise<PlatformUser> {
    return apiRequest(`/admin/users/${discordId}/ban`, {method: "POST", body: {reason}});
}

export function unbanUser(discordId: string): Promise<PlatformUser> {
    return apiRequest(`/admin/users/${discordId}/unban`, {method: "POST"});
}

export function timeoutUser(discordId: string, minutes: number, reason: string): Promise<PlatformUser> {
    return apiRequest(`/admin/users/${discordId}/timeout`, {method: "POST", body: {minutes, reason}});
}

export function liftTimeout(discordId: string): Promise<PlatformUser> {
    return apiRequest(`/admin/users/${discordId}/timeout`, {method: "DELETE"});
}
