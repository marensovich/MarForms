import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {matchPath, Outlet, useLocation, useNavigate} from "react-router-dom";
import {getMyGuilds, type MyGuild} from "../api/dashboard";
import LoadingScreen from "../components/LoadingScreen";
import {useAuth} from "../hooks/useAuth";
import type {DashboardContext} from "./dashboardContext";
import {ADMIN_NAV, readSidebarCollapsed, writeSidebarCollapsed} from "./navigation";
import Sidebar from "./Sidebar";
import Topbar, {type Crumb} from "./Topbar";
import CommandPalette from "./CommandPalette";
import {MobileHeader, MobileMenu, MobileNav} from "./MobileShell";
import {isTypingTarget, newFormTarget, queueTarget} from "./commands";

// Docs: docs/design/mockups/Servers.dc.html (sidebar + topbar + page), ТЗ 4.1.

const GUILD_SECTION_KEYS: Record<string, string> = {
    forms: "shell.guild.forms",
    submissions: "shell.guild.submissions",
    audit: "shell.guild.audit",
    moderators: "shell.guild.moderators",
    bans: "shell.guild.bans",
    billing: "shell.guild.billing",
};

export default function DashboardLayout() {
    const {t} = useTranslation();
    const {user} = useAuth();
    const location = useLocation();
    const [guilds, setGuilds] = useState<MyGuild[] | null>(null);
    const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
    const [reloadKey, setReloadKey] = useState(0);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const closeMenu = useCallback(() => setMenuOpen(false), []);
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        getMyGuilds()
            .then(list => !cancelled && setGuilds(list.filter(g => g.role !== "RESPONDENT")))
            .catch(() => !cancelled && setGuilds([]));
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    // ⌘K / Ctrl+K opens the palette anywhere; N and G→Q work outside text fields (ТЗ ФТ-4.1.3).
    useEffect(() => {
        let pendingG = 0;
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setPaletteOpen(o => !o);
                return;
            }
            if (paletteOpen || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
            if (document.querySelector("[aria-modal=true]")) return;
            const key = e.key.toLowerCase();
            if (key === "q" && Date.now() - pendingG < 1000) {
                pendingG = 0;
                navigate(queueTarget(guilds));
            } else if (key === "g") {
                pendingG = Date.now();
            } else if (key === "n") {
                navigate(newFormTarget(guilds));
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [paletteOpen, guilds, navigate]);

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

    // Owners and moderators of a server get in without the platform DASHBOARD_ACCESS permission;
    // anyone signed in may open «Мои серверы» to connect a server (#151).
    const platformStaff = user?.permissions.includes("DASHBOARD_ACCESS") ?? false;
    if (!platformStaff && guilds === null) return <LoadingScreen/>;

    return (
        <div className="flex min-h-screen bg-bg text-tx">
            {/* On a phone the sidebar is the menu sheet and the topbar a compact header (ТЗ 4.10). */}
            <div className="hidden md:block">
                <Sidebar collapsed={collapsed} onToggle={() => {
                    writeSidebarCollapsed(!collapsed);
                    setCollapsed(!collapsed);
                }}/>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="hidden md:block">
                    <Topbar crumbs={crumbs} onSearch={() => setPaletteOpen(true)}/>
                </div>
                <MobileHeader title={crumbs[crumbs.length - 1].label} onMenu={() => setMenuOpen(true)}/>
                <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-24 pt-4 md:px-10 md:pb-12 md:pt-8">
                    <Outlet context={context}/>
                </main>
                <MobileNav guilds={guilds} onMore={() => setMenuOpen(true)}/>
                <MobileMenu open={menuOpen} onClose={closeMenu}/>
                <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} guilds={guilds}/>
            </div>
        </div>
    );
}

