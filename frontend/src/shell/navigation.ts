import type {IconType} from "react-icons";
import {FiActivity, FiFileText, FiInbox, FiList, FiMessageSquare, FiServer, FiShield, FiSliders, FiUsers} from "react-icons/fi";
import type {AuthUser} from "../types/auth";

// Dashboard navigation (ТЗ 2.2, 2.3, 4.1; docs/design/mockups/Sidebar.dc.html).

export type AdminSection = "forms" | "submissions" | "users" | "roles" | "logs" | "system" | "settings";

export interface NavItem<T extends string = string> {
    id: T;
    labelKey: string;
    icon: IconType;
    to: string;
}

export const SERVERS_NAV: NavItem = {id: "servers", labelKey: "nav.servers", icon: FiServer, to: "/dashboard/servers"};

/** «Обратная связь» (2026-10-19): bugs, ideas and problems of MarForms itself. */
export const FEEDBACK_NAV: NavItem = {id: "feedback", labelKey: "nav.feedback", icon: FiMessageSquare, to: "/feedback"};

/** Platform administration, each behind its permission (sidebar items show only with it). */
export const ADMIN_NAV: (NavItem<AdminSection> & { permission: string })[] = [
    {id: "forms", labelKey: "nav.forms", icon: FiFileText, to: "/admin/forms", permission: "FORMS_MANAGE"},
    {id: "submissions", labelKey: "nav.responses", icon: FiInbox, to: "/admin/submissions", permission: "RESPONSES_MANAGE"},
    {id: "users", labelKey: "nav.users", icon: FiUsers, to: "/admin/users", permission: "USERS_MODERATE"},
    {id: "roles", labelKey: "nav.roles", icon: FiShield, to: "/admin/roles", permission: "ROLES_MANAGE"},
    {id: "logs", labelKey: "nav.logs", icon: FiList, to: "/admin/logs", permission: "SYSTEM_ADMIN"},
    {id: "system", labelKey: "nav.system", icon: FiActivity, to: "/admin/system", permission: "SYSTEM_ADMIN"},
    {id: "settings", labelKey: "nav.settings", icon: FiSliders, to: "/admin/settings", permission: "SYSTEM_ADMIN"},
];

/** Workspace tabs of a server (ТЗ 4.3, #126); moderators, billing and settings are the owner's only. */
export type GuildSection = "forms" | "submissions" | "audit" | "moderators" | "bans" | "billing" | "settings";
export const GUILD_SECTIONS: GuildSection[] = ["forms", "submissions", "audit", "moderators", "bans", "billing", "settings"];
export const OWNER_ONLY_SECTIONS: GuildSection[] = ["moderators", "billing", "settings"];

export function can(user: AuthUser | null, permission: string): boolean {
    const perms = user?.permissions ?? [];
    // Exact permission, as the backend checks it (SYSTEM_ADMIN roles carry every permission explicitly).
    return perms.includes("DASHBOARD_ACCESS") && perms.includes(permission);
}

export function visibleAdminNav(user: AuthUser | null) {
    return ADMIN_NAV.filter(item => can(user, item.permission));
}

/** Platform level badge: System Admin / Admin / Moderator / Staff; none for non-staff. */
export function platformLevelKey(user: AuthUser | null): string | null {
    const perms = user?.permissions ?? [];
    if (!perms.includes("DASHBOARD_ACCESS")) return null;
    if (perms.includes("SYSTEM_ADMIN")) return "adminLevel.systemAdmin";
    if (perms.includes("ROLES_MANAGE")) return "adminLevel.admin";
    if (perms.includes("USERS_MODERATE")) return "adminLevel.moderator";
    return "adminLevel.staff";
}

export const SIDEBAR_STORAGE_KEY = "marforms.sidebar";

export function readSidebarCollapsed(): boolean {
    try {
        return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
    } catch {
        return false;
    }
}

export function writeSidebarCollapsed(collapsed: boolean) {
    try {
        if (collapsed) localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
        else localStorage.removeItem(SIDEBAR_STORAGE_KEY);
    } catch {
        // Private mode: the sidebar just opens expanded next time.
    }
}
