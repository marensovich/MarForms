import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {matchPath, Navigate, Outlet, useLocation} from "react-router-dom";
import {getMyGuilds, type MyGuild} from "../api/dashboard";
import LoadingScreen from "../components/LoadingScreen";
import {useAuth} from "../hooks/useAuth";
import type {DashboardContext} from "./dashboardContext";
import {ADMIN_NAV, readSidebarCollapsed, writeSidebarCollapsed} from "./navigation";
import Sidebar from "./Sidebar";
import Topbar, {type Crumb} from "./Topbar";

// Docs: docs/design/mockups/Servers.dc.html (sidebar + topbar + page), ТЗ 4.1.

const GUILD_SECTION_KEYS: Record<string, string> = {
    forms: "shell.guild.forms",
    submissions: "shell.guild.submissions",
    audit: "shell.guild.audit",
};

export default function DashboardLayout() {
    const {t} = useTranslation();
    const {user} = useAuth();
    const location = useLocation();
    const [guilds, setGuilds] = useState<MyGuild[] | null>(null);
    const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        getMyGuilds()
            .then(list => !cancelled && setGuilds(list.filter(g => g.role !== "RESPONDENT")))
            .catch(() => !cancelled && setGuilds([]));
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const reloadGuilds = useCallback(() => setReloadKey(k => k + 1), []);
    const context: DashboardContext = useMemo(() => ({guilds, reloadGuilds}), [guilds, reloadGuilds]);

    const crumbs = useMemo<Crumb[]>(() => {
        const servers: Crumb = {label: t("shell.myServers"), to: "/dashboard/servers"};
        const guildMatch = matchPath("/dashboard/servers/:guildId/:section", location.pathname);
        if (guildMatch) {
            const guild = guilds?.find(g => g.guildId === guildMatch.params.guildId);
            const sectionKey = GUILD_SECTION_KEYS[guildMatch.params.section ?? ""];
            return [servers, {label: guild?.guildName ?? "…"}, ...(sectionKey ? [{label: t(sectionKey)}] : [])];
        }
        const adminMatch = matchPath("/admin/:section", location.pathname);
        if (adminMatch) {
            const item = ADMIN_NAV.find(n => n.id === adminMatch.params.section);
            return [{label: t("shell.admin")}, {label: item ? t(item.labelKey) : "…"}];
        }
        return [servers];
    }, [location.pathname, guilds, t]);

    // Owners and moderators of a server get in without the platform DASHBOARD_ACCESS permission.
    const platformStaff = user?.permissions.includes("DASHBOARD_ACCESS") ?? false;
    if (!platformStaff && guilds === null) return <LoadingScreen/>;
    if (!platformStaff && guilds !== null && guilds.length === 0 && !user?.permissions.includes("FORMS_MANAGE")) {
        return <Navigate to="/" replace/>;
    }

    return (
        <div className="flex min-h-screen bg-bg text-tx">
            <Sidebar collapsed={collapsed} onToggle={() => {
                writeSidebarCollapsed(!collapsed);
                setCollapsed(!collapsed);
            }}/>
            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar crumbs={crumbs}/>
                <main className="flex min-w-0 flex-1 flex-col gap-6 px-10 pb-12 pt-8">
                    <Outlet context={context}/>
                </main>
            </div>
        </div>
    );
}
