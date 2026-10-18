import {useTranslation} from "react-i18next";
import {FiChevronsLeft, FiChevronsRight, FiMoon, FiSun} from "react-icons/fi";
import {NavLink} from "react-router-dom";
import {useAuth} from "../hooks/useAuth";
import {useTheme} from "../theme/theme";
import {cx} from "../ui";
import {rememberLanguage} from "../languageChoice";
import {type NavItem, SERVERS_NAV, visibleAdminNav} from "./navigation";
import UserMenu from "./UserMenu";

// Docs: docs/design/mockups/Sidebar.dc.html (248 px; collapses to icons, ТЗ ФТ-4.1.1).

function Logo() {
    return (
        <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-pr text-white" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M7 7h10M7 12h10M7 17h5"/>
            </svg>
        </span>
    );
}

function Item({item, collapsed}: { item: NavItem; collapsed: boolean }) {
    const {t} = useTranslation();
    const Icon = item.icon;
    const label = t(item.labelKey);
    return (
        <NavLink to={item.to} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}
                 className={({isActive}) => cx("flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-sm no-underline transition-colors",
                     "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs",
                     collapsed && "justify-center px-0",
                     isActive ? "bg-prs font-semibold text-prt" : "font-medium text-tx hover:bg-s2")}>
            <Icon size={18} className="flex-none" aria-hidden="true"/>
            {!collapsed && label}
        </NavLink>
    );
}

export default function Sidebar({collapsed, onToggle}: { collapsed: boolean; onToggle: () => void }) {
    const {t, i18n} = useTranslation();
    const {user} = useAuth();
    const {theme, setPreference} = useTheme();
    const admin = visibleAdminNav(user);
    const lang = i18n?.language?.startsWith("en") ? "en" : "ru";

    return (
        <nav aria-label={t("shell.mainNav")}
             className={cx("sticky top-0 flex h-screen flex-none flex-col gap-1 border-r border-bd bg-sf pb-3.5 pt-[18px] text-tx transition-[width]",
                 collapsed ? "w-[72px] px-3" : "w-[248px] px-3")}>
            <div className={cx("flex items-center pb-[18px]", collapsed ? "flex-col gap-3" : "gap-2.5 px-2")}>
                <NavLink to={SERVERS_NAV.to} className="flex items-center gap-2.5 text-[17px] font-bold text-tx no-underline"
                         aria-label="MarForms">
                    <Logo/>{!collapsed && "MarForms"}
                </NavLink>
                <button type="button" onClick={onToggle} aria-label={t(collapsed ? "shell.expand" : "shell.collapse")}
                        title={t(collapsed ? "shell.expand" : "shell.collapse")}
                        className={cx("grid h-7 w-7 place-items-center rounded-lg text-mu hover:bg-s2 hover:text-tx",
                            "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs", !collapsed && "ml-auto")}>
                    {collapsed ? <FiChevronsRight size={16} aria-hidden="true"/> : <FiChevronsLeft size={16} aria-hidden="true"/>}
                </button>
            </div>

            <Item item={SERVERS_NAV} collapsed={collapsed}/>

            {admin.length > 0 && (
                <>
                    {collapsed
                        ? <span className="mx-2 my-3 border-t border-bd" aria-hidden="true"/>
                        : <span className="px-2.5 pb-1.5 pt-[18px] text-[11px] font-semibold uppercase tracking-[0.08em] text-mu">
                            {t("shell.admin")}
                        </span>}
                    {admin.map(item => <Item key={item.id} item={item} collapsed={collapsed}/>)}
                </>
            )}

            <div className="mt-auto flex flex-col gap-2.5 pt-4">
                <div className={cx("flex gap-1.5", collapsed ? "flex-col items-center" : "px-1")}>
                    {!collapsed && (
                        <div role="radiogroup" aria-label={t("shell.language")}
                             className="flex flex-1 rounded-[10px] border border-bd p-0.5 text-xs font-semibold">
                            {(["ru", "en"] as const).map(code => (
                                <button key={code} type="button" role="radio" aria-checked={lang === code}
                                        onClick={() => {
                                            rememberLanguage(code);
                                            i18n?.changeLanguage(code);
                                        }}
                                        className={cx("h-7 flex-1 rounded-lg uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr",
                                            lang === code ? "bg-prs text-prt" : "text-mu hover:text-tx")}>
                                    {code}
                                </button>
                            ))}
                        </div>
                    )}
                    <button type="button" onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
                            aria-label={t(theme === "dark" ? "shell.lightTheme" : "shell.darkTheme")}
                            title={t(theme === "dark" ? "shell.lightTheme" : "shell.darkTheme")}
                            className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] border border-bd bg-sf text-mu hover:bg-s2 hover:text-tx focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
                        {theme === "dark" ? <FiSun size={16} aria-hidden="true"/> : <FiMoon size={16} aria-hidden="true"/>}
                    </button>
                </div>
                <UserMenu variant="sidebar" collapsed={collapsed}/>
            </div>
        </nav>
    );
}
