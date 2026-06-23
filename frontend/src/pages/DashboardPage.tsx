import SettingsTab from "../components/dashboard/SettingsTab";
import {useAuth} from "../hooks/useAuth";
import {useState} from "react";
import {BackgroundGlow} from "../components/LoadingScreen.tsx";
import {Navigate} from "react-router-dom";
import {AnimatePresence, motion} from "framer-motion";
import FormsTab from "../components/dashboard/FormsTab.tsx";
import UsersTab from "../components/dashboard/UsersTab.tsx";
import RolesTab from "../components/dashboard/RolesTab.tsx";

// Обновляем TABS — Settings только для SYSTEM_ADMIN
const TABS = [
    {id: "forms", label: "Forms", icon: "📋", permission: "FORMS_VIEW"},
    {id: "users", label: "Users", icon: "👥", permission: "USERS_VIEW"},
    {id: "roles", label: "Roles", icon: "🔑", permission: "ROLES_MANAGE"},
    {id: "settings", label: "Settings", icon: "⚙️", permission: "SYSTEM_ADMIN"},
] as const;

type Tab = typeof TABS[number]["id"];

export default function DashboardPage() {
    const {user} = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>("forms");

    const hasDashboardAccess = user?.permissions.includes("DASHBOARD_ACCESS") ?? false;
    if (!hasDashboardAccess) return <Navigate to="/" replace/>;

    const visibleTabs = TABS.filter(tab =>
        user?.permissions.includes(tab.permission)
    );

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0f]">
            <BackgroundGlow/>
            <div className="relative z-10 flex min-h-screen">
                <aside className="flex w-56 flex-col border-r border-white/10 bg-white/[0.02] p-4">
                    <div className="mb-8 flex items-center gap-2.5 px-2 pt-2">
                        <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
                            MF
                        </div>
                        <span className="font-semibold text-white">
              {user?.permissions.includes("SYSTEM_ADMIN")
                  ? "MarForms" // можно взять из настроек позже
                  : "MarForms"}
            </span>
                    </div>

                    <nav className="flex flex-col gap-1">
                        {visibleTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? "bg-indigo-500/20 text-indigo-300"
                                        : "text-white/50 hover:bg-white/5 hover:text-white"
                                }`}
                            >
                                <span>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    <div className="mt-auto border-t border-white/10 pt-4">
                        <p className="px-2 text-xs text-white/30">
                            {user?.discordUsername ?? ""}
                        </p>
                    </div>
                </aside>

                <main className="flex-1 overflow-auto p-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{opacity: 0, y: 8}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -8}}
                            transition={{duration: 0.2}}
                        >
                            {activeTab === "forms" && <FormsTab/>}
                            {activeTab === "users" && <UsersTab/>}
                            {activeTab === "roles" && <RolesTab/>}
                            {activeTab === "settings" && <SettingsTab/>}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}