import SettingsTab from "../components/dashboard/SettingsTab";
import SystemTab from "../components/dashboard/SystemTab";
import LogsTab from "../components/dashboard/LogsTab";
import {useAuth} from "../hooks/useAuth";
import {useState} from "react";
import {BackgroundGlow} from "../components/LoadingScreen.tsx";
import {Navigate} from "react-router-dom";
import {AnimatePresence, motion} from "framer-motion";
import FormsTab from "../components/dashboard/FormsTab.tsx";
import UsersTab from "../components/dashboard/UsersTab.tsx";
import RolesTab from "../components/dashboard/RolesTab.tsx";
import ResponsesTab from "../components/dashboard/ResponsesTab.tsx";
import {FiActivity, FiFileText, FiInbox, FiList, FiSettings, FiShield, FiUsers,} from "react-icons/fi";
import {useTranslation} from "react-i18next";

const TABS = [
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
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
            {letters.toUpperCase()}
        </div>
    );
}

export default function DashboardPage() {
    const {user} = useAuth();
    const {t} = useTranslation();
    const [activeTab, setActiveTab] = useState<Tab>("forms");

    const hasDashboardAccess = user?.permissions.includes("DASHBOARD_ACCESS") ?? false;
    if (!hasDashboardAccess) return <Navigate to="/" replace/>;

    const visibleTabs = TABS.filter(tab => user?.permissions.includes(tab.permission));
    const adminLevelKey = getAdminLevelKey(user?.permissions ?? []);

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#0f0f1c]">
            <BackgroundGlow/>
            <div className="relative z-10 flex min-h-screen">

                {/* Sidebar */}
                <aside className="flex w-60 flex-col border-r border-white/[0.10] bg-[#0d0d1e]">
                    {/* Logo */}
                    <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
                        <img src="/logo.png" alt="MarForms"
                             className="h-8 w-8 flex-shrink-0 rounded-lg object-cover shadow-lg shadow-indigo-500/20"/>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">MarForms</p>
                            <p className="text-[10px] text-white/50">{t("nav.dashboard")}</p>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex flex-col gap-0.5 p-3 pt-4">
                        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
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
                                            ? "bg-indigo-500/15 text-indigo-300"
                                            : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                                    }`}
                                >
                                    {active && (
                                        <motion.div
                                            layoutId="sidebar-indicator"
                                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo-400"
                                        />
                                    )}
                                    <Icon size={15} className="flex-shrink-0"/>
                                    <span className="font-medium">{t(tab.labelKey)}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Bottom user section */}
                    <div className="mt-auto border-t border-white/[0.06] p-4">
                        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                            <Initials name={user?.discordUsername ?? "?"}/>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-white/90">
                                    {user?.discordUsername ?? t("common.unknown")}
                                </p>
                                <p className="text-[10px] text-white/50">{t(adminLevelKey)}</p>
                            </div>
                            <div
                                className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"
                                title="Online"/>
                        </div>
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-auto">
                    {/* Top bar */}
                    <div
                        className="sticky top-0 z-20 flex h-14 items-center border-b border-white/[0.10] bg-[#0f0f1c]/90 px-8 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-white/50">{t("nav.dashboard")}</span>
                            <span className="text-white/40">/</span>
                            <span className="font-medium text-white/70">{t(visibleTabs.find(t => t.id === activeTab)?.labelKey ?? "nav.forms")}</span>
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
