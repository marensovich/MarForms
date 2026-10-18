import {useCallback, useEffect, useId, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiBell, FiInbox, FiRefreshCw, FiSlash} from "react-icons/fi";
import {useNavigate} from "react-router-dom";
import {
    type AppNotification,
    getNotifications,
    getUnreadNotificationCount,
    markAllNotificationsRead,
    markNotificationRead,
    type NotificationType,
} from "../api/notifications";
import {cx} from "../ui";

// Docs: docs/design/mockups/Topbar.dc.html (the bell); ТЗ ФТ-4.1.2, #123.

const POLL_MS = 30_000;

const ICONS: Record<NotificationType, typeof FiBell> = {
    NEW_SUBMISSION: FiInbox,
    SUBMISSION_RESUBMITTED: FiRefreshCw,
    WEBHOOK_PROBLEM: FiAlertTriangle,
    BOT_REMOVED: FiSlash,
};

/**
 * The bell of the topbar: the unread counter (every 30 s and when the tab gets
 * focus), a list that leads to the object, and «Прочитать все».
 */
export default function NotificationBell() {
    const {t, i18n} = useTranslation();
    const navigate = useNavigate();
    const [count, setCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<AppNotification[] | null>(null);
    const [failed, setFailed] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();

    const refreshCount = useCallback(() => {
        getUnreadNotificationCount().then(r => setCount(r.count)).catch(() => undefined);
    }, []);

    useEffect(() => {
        refreshCount();
        const timer = window.setInterval(refreshCount, POLL_MS);
        const onFocus = () => document.visibilityState === "visible" && refreshCount();
        document.addEventListener("visibilitychange", onFocus);
        window.addEventListener("focus", onFocus);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onFocus);
            window.removeEventListener("focus", onFocus);
        };
    }, [refreshCount]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        getNotifications()
            .then(p => {
                if (cancelled) return;
                setItems(p.content);
                setFailed(false);
            })
            .catch(() => !cancelled && setFailed(true));
        const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false);
                buttonRef.current?.focus();
            }
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            cancelled = true;
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const go = (n: AppNotification) => {
        setOpen(false);
        if (!n.read) {
            markNotificationRead(n.id).then(refreshCount).catch(() => undefined);
            setItems(list => list?.map(x => x.id === n.id ? {...x, read: true} : x) ?? null);
        }
        if (n.link) navigate(n.link);
    };

    const readAll = () => {
        markAllNotificationsRead().then(() => {
            setCount(0);
            setItems(list => list?.map(x => ({...x, read: true})) ?? null);
        }).catch(() => undefined);
    };

    const when = (iso: string) => new Date(iso).toLocaleString(i18n.language,
        {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});

    return (
        <div ref={rootRef} className="relative">
            <button ref={buttonRef} type="button" onClick={() => setOpen(o => !o)}
                    aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
                    aria-label={count > 0 ? t("notifications.labelUnread", {count}) : t("notifications.label")}
                    className="relative grid h-9 w-9 place-items-center rounded-[10px] border border-bd bg-sf text-tx hover:bg-s2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
                <FiBell size={17} aria-hidden="true"/>
                {count > 0 && (
                    <span aria-hidden="true" className="absolute right-[7px] top-1.5 h-2 w-2 rounded-full border-2 border-sf bg-dg"/>
                )}
            </button>
            {open && (
                <div id={panelId} role="dialog" aria-label={t("notifications.title")}
                     className="absolute right-0 top-[calc(100%+8px)] z-40 flex w-[360px] max-w-[calc(100vw-32px)] flex-col rounded-[14px] border border-bd bg-sf shadow-popover">
                    <div className="flex items-center justify-between border-b border-bd px-4 py-3">
                        <span className="text-sm font-bold text-tx">{t("notifications.title")}</span>
                        <button type="button" onClick={readAll} disabled={count === 0}
                                className="text-xs font-semibold text-prt hover:underline disabled:cursor-default disabled:text-mu disabled:no-underline">
                            {t("notifications.readAll")}
                        </button>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto p-1.5">
                        {failed ? (
                            <p className="m-0 p-4 text-center text-[13px] text-rdt">{t("notifications.loadError")}</p>
                        ) : items === null ? (
                            <p className="m-0 p-4 text-center text-[13px] text-mu">{t("common.loading")}</p>
                        ) : items.length === 0 ? (
                            <p className="m-0 p-6 text-center text-[13px] text-mu">{t("notifications.empty")}</p>
                        ) : (
                            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                                {items.map(n => {
                                    const Icon = ICONS[n.type] ?? FiBell;
                                    return (
                                        <li key={n.id}>
                                            <button type="button" onClick={() => go(n)}
                                                    className={cx("flex w-full gap-3 rounded-[10px] px-2.5 py-2.5 text-left hover:bg-s2 focus-visible:bg-s2 focus-visible:outline-none",
                                                        !n.read && "bg-prs/50")}>
                                                <span className={cx("grid h-8 w-8 flex-none place-items-center rounded-[9px]",
                                                    n.type === "WEBHOOK_PROBLEM" || n.type === "BOT_REMOVED" ? "bg-rdb text-rdt" : "bg-prs text-prt")}>
                                                    <Icon size={15} aria-hidden="true"/>
                                                </span>
                                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                    <span className="text-[13px] leading-snug text-tx">
                                                        {t(`notifications.types.${n.type}`, {...n.params, author: n.params.author ?? t("notifications.someone")})}
                                                    </span>
                                                    <span className="text-xs text-mu">{when(n.createdAt)}</span>
                                                </span>
                                                {!n.read && <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-pr" aria-label={t("notifications.unread")}/>}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
