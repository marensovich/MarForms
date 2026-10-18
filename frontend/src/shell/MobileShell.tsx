import {useEffect, useRef} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import type {IconType} from "react-icons";
import {FiFileText, FiInbox, FiMenu, FiMoreHorizontal, FiServer} from "react-icons/fi";
import {matchPath, NavLink, useLocation} from "react-router-dom";
import type {MyGuild} from "../api/dashboard";
import {useAuth} from "../hooks/useAuth";
import {Avatar, cx, useFocusTrap} from "../ui";
import {queueTarget} from "./commands";
import NotificationBell from "./NotificationBell";
import Sidebar from "./Sidebar";

// Docs: docs/design/mockups/MobileShell.dc.html; ТЗ 4.10, 8.2.

/** The phone's top bar: the menu, the page's name, the bell and the user. */
export function MobileHeader({title, onMenu}: { title: string; onMenu: () => void }) {
    const {t} = useTranslation();
    const {user} = useAuth();
    return (
        <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-bd bg-sf px-3 py-2.5 md:hidden">
            <button type="button" onClick={onMenu} aria-label={t("shell.openMenu")}
                    className="grid h-11 w-11 place-items-center rounded-xl text-tx hover:bg-s2">
                <FiMenu size={22} aria-hidden="true"/>
            </button>
            <span className="min-w-0 flex-1 truncate text-[17px] font-bold">{title}</span>
            <NotificationBell/>
            {user && <Avatar name={user.discordUsername} src={user.avatarUrl} size={34}/>}
        </header>
    );
}

/** The phone's bottom bar: «Серверы», «Заявки», «Формы», «Ещё» (the menu). */
export function MobileNav({guilds, onMore}: { guilds: MyGuild[] | null; onMore: () => void }) {
    const {t} = useTranslation();
    const {pathname} = useLocation();
    // Inside a server, «Заявки» and «Формы» are that server's; otherwise the only server's, or the list.
    const current = matchPath("/dashboard/servers/:guildId/*", pathname)?.params.guildId
        ?? (guilds?.length === 1 ? guilds[0].guildId : null);
    const tabs: { key: string; to: string; icon: IconType; active: boolean }[] = [
        {key: "servers", to: "/dashboard/servers", icon: FiServer, active: pathname === "/dashboard/servers"},
        {key: "submissions", to: current ? `/dashboard/servers/${current}/submissions` : queueTarget(guilds), icon: FiInbox,
            active: pathname.endsWith("/submissions")},
        {key: "forms", to: current ? `/dashboard/servers/${current}/forms` : "/dashboard/servers", icon: FiFileText,
            active: pathname.endsWith("/forms")},
    ];
    const cls = (active: boolean) => cx("flex flex-col items-center gap-1 py-2 text-[11px] no-underline",
        active ? "font-semibold text-prt" : "font-medium text-mu");
    return (
        <nav aria-label={t("shell.bottomNav")}
             className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-bd bg-sf px-2 pb-3.5 pt-1.5 md:hidden">
            {tabs.map(tab => (
                <NavLink key={tab.key} to={tab.to} aria-current={tab.active ? "page" : undefined} className={cls(tab.active)}>
                    <tab.icon size={22} aria-hidden="true"/>{t(`shell.mobileTabs.${tab.key}`)}
                </NavLink>
            ))}
            <button type="button" onClick={onMore} className={cls(false)}>
                <FiMoreHorizontal size={22} aria-hidden="true"/>{t("shell.mobileTabs.more")}
            </button>
        </nav>
    );
}

/** The sidebar as a sheet from the left; a link followed closes it. */
export function MobileMenu({open, onClose}: { open: boolean; onClose: () => void }) {
    const {t} = useTranslation();
    const ref = useRef<HTMLDivElement>(null);
    const {pathname} = useLocation();
    const opened = useRef(pathname);
    useFocusTrap(ref, open, onClose);
    useEffect(() => {
        if (!open) {
            opened.current = pathname;
            return;
        }
        if (pathname !== opened.current) onClose();
    }, [open, pathname, onClose]);
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex bg-ov md:hidden" onMouseDown={e => e.target === e.currentTarget && onClose()}>
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("shell.mainNav")} tabIndex={-1} className="h-full outline-none">
                <Sidebar collapsed={false} onToggle={onClose}/>
            </div>
        </div>,
        document.body,
    );
}
