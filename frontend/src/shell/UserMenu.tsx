import {useEffect, useId, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiChevronDown, FiInbox, FiLogOut} from "react-icons/fi";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../hooks/useAuth";
import {Avatar, cx} from "../ui";
import {platformLevelKey} from "./navigation";

/**
 * User menu (Sidebar.dc.html / Topbar.dc.html): name, Discord ID, platform level,
 * "Мои заявки", "Выйти". `variant` picks the sidebar card or the compact topbar button.
 */
export default function UserMenu({variant, collapsed}: { variant: "sidebar" | "topbar"; collapsed?: boolean }) {
    const {t} = useTranslation();
    const {user, logout} = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        rootRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
        const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    if (!user) return null;
    const levelKey = platformLevelKey(user);
    const level = levelKey && (
        <span className="rounded-md bg-prs px-1.5 py-px text-[11px] font-semibold text-prt">{t(levelKey)}</span>
    );

    const onMenuKey = (e: React.KeyboardEvent) => {
        const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        if (e.key === "Escape") {
            setOpen(false);
            buttonRef.current?.focus();
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
        }
    };

    const item = "flex h-[38px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-s2 focus-visible:bg-s2 focus-visible:outline-none";
    return (
        <div ref={rootRef} className="relative">
            {open && (
                <div id={menuId} role="menu" aria-label={t("shell.userMenu")} onKeyDown={onMenuKey}
                     className={cx("absolute z-40 flex flex-col gap-0.5 rounded-[14px] border border-bd bg-sf p-1.5 shadow-popover",
                         variant === "sidebar" ? "bottom-[calc(100%+8px)] left-0 w-[224px]" : "right-0 top-[calc(100%+8px)] w-[240px]")}>
                    <div className="mb-1 flex flex-col gap-0.5 border-b border-bd p-2.5">
                        <span className="text-[13px] font-semibold text-tx">{user.discordUsername}</span>
                        <span className="font-mono text-xs text-mu">ID {user.id}</span>
                    </div>
                    <button type="button" role="menuitem" className={cx(item, "text-tx")}
                            onClick={() => { setOpen(false); navigate("/me/submissions"); }}>
                        <FiInbox size={16} aria-hidden="true"/>{t("shell.mySubmissions")}
                    </button>
                    <button type="button" role="menuitem" className={cx(item, "text-rdt")} onClick={logout}>
                        <FiLogOut size={16} aria-hidden="true"/>{t("common.signOut")}
                    </button>
                </div>
            )}
            {variant === "sidebar" ? (
                <button ref={buttonRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
                        aria-label={collapsed ? user.discordUsername : undefined} onClick={() => setOpen(o => !o)}
                        className={cx("flex w-full items-center gap-2.5 rounded-xl border p-2 text-left text-tx",
                            "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs",
                            open ? "border-pr bg-s2" : "border-bd bg-sf hover:bg-s2", collapsed && "justify-center")}>
                    <Avatar name={user.discordUsername} src={user.avatarUrl} size={36}/>
                    {!collapsed && (
                        <>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm font-semibold">{user.discordUsername}</span>
                                {level && <span className="flex items-center gap-1.5 text-xs text-mu">{level}</span>}
                            </span>
                            <FiChevronDown size={16} className="flex-none text-mu" aria-hidden="true"/>
                        </>
                    )}
                </button>
            ) : (
                <button ref={buttonRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
                        onClick={() => setOpen(o => !o)}
                        className="flex h-9 items-center gap-2 rounded-[10px] border border-bd bg-sf pl-1 pr-2 text-tx hover:bg-s2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
                    <Avatar name={user.discordUsername} src={user.avatarUrl} size={28}/>
                    <span className="max-w-[160px] truncate text-[13px] font-semibold">{user.discordUsername}</span>
                    {level}
                    <FiChevronDown size={14} className="text-mu" aria-hidden="true"/>
                </button>
            )}
        </div>
    );
}
