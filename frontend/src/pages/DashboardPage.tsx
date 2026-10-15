import SettingsTab from "../components/dashboard/SettingsTab";
import SystemTab from "../components/dashboard/SystemTab";
import LogsTab from "../components/dashboard/LogsTab";
import {useAuth} from "../hooks/useAuth";
import {useEffect, useState} from "react";
import ServersTab from "../components/dashboard/ServersTab";
import LoadingScreen from "../components/LoadingScreen";
import {getMyGuilds} from "../api/dashboard";
import {Navigate} from "react-router-dom";
import {AnimatePresence, motion} from "framer-motion";
import FormsTab from "../components/dashboard/FormsTab.tsx";
import UsersTab from "../components/dashboard/UsersTab.tsx";
import RolesTab from "../components/dashboard/RolesTab.tsx";
import ResponsesTab from "../components/dashboard/ResponsesTab.tsx";
import {FiActivity, FiFileText, FiInbox, FiList, FiLogOut, FiServer, FiSettings, FiShield, FiUsers,} from "react-icons/fi";
import {useTranslation} from "react-i18next";
import ThemeToggle from "../theme/ThemeToggle";

// `permission: null` = shown to anyone who owns or moderates a server
// (per-guild role), regardless of global platform permissions.
const TABS = [
    {id: "servers", labelKey: "nav.servers", icon: FiServer, permission: null},
    {id: "forms", labelKey: "nav.forms", icon: FiFileText, permission: "FORMS_MANAGE"},
    {id: "responses", labelKey: "nav.responses", icon: FiInbox, permission: "RESPONSES_MANAGE"},
    {id: "users", labelKey: "nav.users", icon: FiUsers, permission: "USERS_MODERATE"},
    {id: "roles", labelKey: "nav.roles", icon: FiShield, permission: "ROLES_MANAGE"},
    {id: "logs", labelKey: "nav.logs", icon: FiList, permission: "SYSTEM_ADMIN"},
    {id: "system", labelKey: "nav.system", icon: FiActivity, permission: "SYSTEM_ADMIN"},
    {id: "settings", labelKey: "nav.settings", icon: FiSettings, permission: "SYSTEM_ADMIN"},
] as const;

type Tab = typeof TABS[number]["id"];

function getAdminLevelKey(permissions: string[]): string {
    if (permissions.includes("SYSTEM_ADMIN")) return "adminLevel.systemAdmin";
    if (permissions.includes("ROLES_MANAGE")) return "adminLevel.admin";
    if (permissions.includes("USERS_MODERATE")) return "adminLevel.moderator";
    return "adminLevel.staff";
}

function Initials({name}: { name: string }) {
    const parts = name.replace(/#\d+$/, "").split(/[\s_]+/);
    const letters = parts.length >= 2
        ? parts[0][0] + parts[1][0]
        : (name[0] ?? "?").toUpperCase();
    return (
        <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-pr text-xs font-bold text-white">
            {letters.toUpperCase()}
        </div>
    );
}

export default function DashboardPage() {
    const {user, logout} = useAuth();
    const {t} = useTranslation();
    // Returning from Stripe Checkout lands on the servers tab, where billing reopens.
    const [selectedTab, setSelectedTab] = useState<Tab | null>(
        () => new URLSearchParams(window.location.search).has("billing") ? "servers" : null
    );
    // null = still loading. Owners/moderators of a server get into the
    // dashboard even without the global DASHBOARD_ACCESS permission.
    const [hasGuildStaffRole, setHasGuildStaffRole] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        getMyGuilds()
            .then(guilds => {
                if (!cancelled) setHasGuildStaffRole(guilds.some(g => g.role !== "RESPONDENT"));
            })
            .catch(() => {
                if (!cancelled) setHasGuildStaffRole(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const hasDashboardAccess = user?.permissions.includes("DASHBOARD_ACCESS") ?? false;
    if (!hasDashboardAccess && hasGuildStaffRole === null) return <LoadingScreen/>;
    if (!hasDashboardAccess && !hasGuildStaffRole) return <Navigate to="/" replace/>;

    const visibleTabs = TABS.filter(tab => tab.permission === null
        ? hasGuildStaffRole || user?.permissions.includes("FORMS_MANAGE")
        : hasDashboardAccess && user?.permissions.includes(tab.permission));
    const activeTab: Tab = selectedTab && visibleTabs.some(tab => tab.id === selectedTab)
        ? selectedTab
        : (visibleTabs.find(tab => tab.id === "forms") ?? visibleTabs[0])?.id ?? "servers";
    const setActiveTab = setSelectedTab;
    const adminLevelKey = getAdminLevelKey(user?.permissions ?? []);

    return (
        <div className="relative min-h-screen w-full bg-s2">
            <div className="relative z-10 flex min-h-screen">

                {/* Sidebar */}
                <aside className="flex w-60 flex-col border-r border-bd bg-sf">
                    {/* Logo */}
                    <div className="flex items-center gap-3 border-b border-bd px-5 py-4">
                        <img src="/logo.svg" alt="MarForms"
                             className="h-8 w-8 flex-shrink-0 rounded-lg object-cover"/>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-tx">MarForms</p>
                            <p className="text-[10px] text-mu">{t("nav.dashboard")}</p>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex flex-col gap-0.5 p-3 pt-4">
                        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-mu">
                            {t("nav.navigation")}
                        </p>
                        {visibleTabs.map(tab => {
                            const active = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                                        active
                                            ? "bg-prs text-prt"
                                            : "text-mu hover:bg-s2 hover:text-tx"
                                    }`}
                                >
                                    {active && (
                                        <motion.div
                                            layoutId="sidebar-indicator"
                                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-pr"
                                        />
                                    )}
                                    <Icon size={15} className="flex-shrink-0"/>
                                    <span className="font-medium">{t(tab.labelKey)}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Bottom user section */}
                    <div className="mt-auto border-t border-bd p-4">
                        <div className="mb-2 px-2"><ThemeToggle/></div>
                        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                            <Initials name={user?.discordUsername ?? "?"}/>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-tx">
                                    {user?.discordUsername ?? t("common.unknown")}
                                </p>
                                <p className="text-[10px] text-mu">{t(adminLevelKey)}</p>
                            </div>
                            <button
                                onClick={logout}
                                title={t("common.signOut")}
                                aria-label={t("common.signOut")}
                                className="flex-shrink-0 rounded-md p-1.5 text-mu transition-colors hover:bg-s2 hover:text-tx"
                            >
                                <FiLogOut size={14}/>
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-auto">
                    {/* Top bar */}
                    <div
                        className="sticky top-0 z-20 flex h-14 items-center border-b border-bd bg-sf/90 px-8 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-mu">{t("nav.dashboard")}</span>
                            <span className="text-mu/70">/</span>
                            <span className="font-medium text-mu">{t(visibleTabs.find(t => t.id === activeTab)?.labelKey ?? "nav.forms")}</span>
                        </div>
                    </div>

                    <div className="p-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{opacity: 0, y: 6}}
                                animate={{opacity: 1, y: 0}}
                                exit={{opacity: 0, y: -6}}
                                transition={{duration: 0.18}}
                            >
                                {activeTab === "servers" && <ServersTab/>}
                                {activeTab === "forms" && <FormsTab/>}
                                {activeTab === "responses" && <ResponsesTab/>}
                                {activeTab === "users" && <UsersTab/>}
                                {activeTab === "roles" && <RolesTab/>}
                                {activeTab === "logs" && <LogsTab/>}
                                {activeTab === "system" && <SystemTab/>}
                                {activeTab === "settings" && <SettingsTab/>}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    );
}
