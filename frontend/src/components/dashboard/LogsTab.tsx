import {Fragment, useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiChevronDown, FiChevronRight, FiRefreshCw} from "react-icons/fi";
import {ApiError} from "../../api/client";
import {describeApiError} from "../../api/errors";
import {getAuditLogs, getLogStats, type LogStats, streamAuditLogs} from "../../api/logs";
import type {AuditAction, AuditLogEntry} from "../../types/logs";
import {Avatar, cx, DiffView, EmptyState, ErrorState, KpiCard, Pagination, Skeleton} from "../../ui";
import {foldDiff, foldRuns} from "./auditRuns";

// Docs: docs/design/mockups/AdminLogs.dc.html; ТЗ 6.5, 8.6.

type Category = "ban" | "role" | "form" | "sub" | "mod" | "sys";

/** Each action's badge colour, by category (AdminLogs.dc.html). */
const CATEGORY: Record<AuditAction, Category> = {
    USER_LOGIN: "sys",
    USER_BANNED: "ban",
    USER_UNBANNED: "ban",
    USER_TIMED_OUT: "ban",
    USER_TIMEOUT_LIFTED: "ban",
    USER_ROLES_UPDATED: "role",
    FORM_CREATED: "form",
    FORM_UPDATED: "form",
    FORM_DELETED: "form",
    FORM_STATUS_CHANGED: "form",
    SUBMISSION_CREATED: "sub",
    SUBMISSION_DELETED: "sub",
    SUBMISSION_DECIDED: "sub",
    SUBMISSION_DM_FAILED: "sub",
    ROLE_CREATED: "role",
    ROLE_UPDATED: "role",
    ROLE_DELETED: "role",
    SETTINGS_UPDATED: "sys",
    MODERATOR_ADDED: "mod",
    MODERATOR_REMOVED: "mod",
    MODERATOR_FORMS_CHANGED: "mod",
    GUILD_BAN_ADDED: "ban",
    GUILD_BAN_REMOVED: "ban",
    GUILD_CONNECTED: "sys",
    GUILD_ROLE_REVOKED: "role",
    BOT_REMOVED: "sys",
    BOT_RECONNECTED: "sys",
    BOT_PERMISSIONS_MISSING: "sys",
    WEBHOOK_FAILING: "sys",
    WEBHOOK_CREATED: "form",
    GUILD_ADMIN_ROLES_CHANGED: "role",
    GUILD_ROLE_GRANTED: "role",
    GUILD_LOG_CHANNELS_CREATED: "sys",
};
const BADGE: Record<Category, string> = {
    ban: "bg-rdb text-rdt", role: "bg-prs text-prt", form: "bg-inb text-int", sub: "bg-gnb text-gnt", mod: "bg-amb text-amt", sys: "bg-s2 text-tx",
};
const ACTIONS = Object.keys(CATEGORY) as AuditAction[];
const PAGE_SIZE = 25;
const RECONNECT_MS = 3000;

/**
 * Платформа · Журнал (ТЗ 6.5): the number of entries, «Live» (new entries
 * appear without reloading), «Обновить», the KPIs, filters by actions, a
 * participant and dates, and the entries — time to the second, the action's
 * badge, who with their avatar, the object and the details; a change opens
 * into its diff.
 */
export default function LogsTab() {
    const {t, i18n} = useTranslation();
    const [actions, setActions] = useState<AuditAction[]>([]);
    const [participant, setParticipant] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [page, setPage] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);
    const [data, setData] = useState<{ key: string; rows: AuditLogEntry[]; total: number; pages: number } | null>(null);
    const [error, setError] = useState<{ message: string; code?: string } | null>(null);
    const [stats, setStats] = useState<LogStats | null>(null);
    const [open, setOpen] = useState<Set<string>>(new Set());
    const [live, setLive] = useState(true);
    const [connected, setConnected] = useState(false);
    const [fresh, setFresh] = useState<Set<string>>(new Set());

    const id = /^\d{5,20}$/.test(participant.trim()) ? participant.trim() : "";
    const key = JSON.stringify({actions, id, from, to, page, reloadKey});
    useEffect(() => {
        let cancelled = false;
        getAuditLogs({actions, participant: id || undefined, from: from || undefined, to: to || undefined, page, size: PAGE_SIZE})
            .then(r => {
                if (cancelled) return;
                setData({key, rows: r.content, total: r.page.totalElements, pages: r.page.totalPages});
                setError(null);
            })
            .catch(e => !cancelled && setError({
                message: describeApiError(e, t("adminLogs.loadError")),
                code: e instanceof ApiError ? `HTTP ${e.status}` : undefined,
            }));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- key carries every input
    }, [key, t]);
    useEffect(() => {
        getLogStats().then(setStats).catch(() => undefined);
    }, [reloadKey]);

    // «Live»: a new entry that matches the filters joins the first page at once.
    const matches = useRef<(e: AuditLogEntry) => boolean>(() => false);
    useEffect(() => {
        matches.current = e => page === 0
            && (actions.length === 0 || actions.includes(e.action))
            && (!id || e.actorDiscordId === id || e.targetId === id)
            && (!from || e.createdAt.slice(0, 10) >= from)
            && (!to || e.createdAt.slice(0, 10) <= to);
    }, [page, actions, id, from, to]);
    useEffect(() => {
        if (!live) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const connect = () => {
            streamAuditLogs(entry => {
                setStats(s => s && {...s, total: s.total + 1, today: s.today + 1});
                if (!matches.current(entry)) return;
                setData(d => d && {...d, rows: [entry, ...d.rows.filter(r => r.id !== entry.id)].slice(0, PAGE_SIZE), total: d.total + 1});
                setFresh(f => new Set(f).add(entry.id));
            }, () => setConnected(true), controller.signal)
                .catch(() => undefined)
                .finally(() => {
                    setConnected(false);
                    if (!controller.signal.aborted) timer = setTimeout(connect, RECONNECT_MS);
                });
        };
        connect();
        return () => {
            controller.abort();
            clearTimeout(timer);
            setConnected(false);
        };
    }, [live]);

    const loading = !error && data?.key !== key;
    // Runs of one action by one person on one object read as one line, as in a server's journal (2026-10-19).
    const rows = (data?.key === key ? foldRuns(data.rows) : []).map(r => r.runOf.length > 1 ? {...r, diff: foldDiff(r.runOf.map(x => x.diff))} : r);
    const filtered = actions.length > 0 || participant !== "" || from !== "" || to !== "";
    const n = (v: number) => v.toLocaleString(i18n.language);
    const time = (iso: string) => {
        const d = new Date(iso);
        return `${d.toLocaleDateString(i18n.language, {day: "2-digit", month: "2-digit"})} ${d.toLocaleTimeString(i18n.language, {hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false})}`;
    };
    const reset = () => {
        setActions([]);
        setParticipant("");
        setFrom("");
        setTo("");
        setPage(0);
    };
    const toggle = (entryId: string) => setOpen(prev => {
        const next = new Set(prev);
        if (next.has(entryId)) next.delete(entryId);
        else next.add(entryId);
        return next;
    });
    const input = "h-[38px] rounded-[10px] border border-bd bg-sf px-3 text-[13px] text-tx outline-none focus:border-pr";

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="m-0 flex flex-wrap items-baseline gap-3 text-[26px] font-bold tracking-[-0.01em]">
                        {t("adminLogs.title")}
                        {stats && <span className="text-sm font-medium text-mu">{t("adminLogs.entries", {count: stats.total, value: n(stats.total)})}</span>}
                    </h1>
                    <p className="m-0 text-sm text-mu">{t("adminLogs.subtitle")}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" role="switch" aria-checked={live} onClick={() => setLive(v => !v)}
                            title={live ? (connected ? t("adminLogs.liveOn") : t("adminLogs.liveConnecting")) : t("adminLogs.liveOff")}
                            className={cx("flex h-[38px] items-center gap-2 rounded-[10px] border px-3 text-[13px] font-semibold",
                                live ? "border-gnb bg-gnb text-gnt" : "border-bd bg-sf text-mu")}>
                        <span aria-hidden="true" className={cx("h-2 w-2 rounded-full", live && connected ? "animate-pulse bg-ok" : live ? "bg-wr" : "bg-mu")}/>
                        {t("adminLogs.live")}
                    </button>
                    <button type="button" onClick={() => setReloadKey(k => k + 1)}
                            className="flex h-[38px] items-center gap-2 rounded-[10px] border border-bd bg-sf px-3 text-[13px] font-medium text-tx hover:bg-s2">
                        <FiRefreshCw size={14} aria-hidden="true"/>{t("adminLogs.refresh")}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
                <KpiCard label={t("adminLogs.kpi.today")} value={stats ? n(stats.today) : "—"}/>
                <KpiCard label={t("adminLogs.kpi.decisions")} value={stats ? n(stats.decisions) : "—"}/>
                <KpiCard label={t("adminLogs.kpi.restrictions")} value={stats ? n(stats.restrictions) : "—"}/>
                <KpiCard label={t("adminLogs.kpi.rights")} value={stats ? n(stats.rights) : "—"}/>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
                <ActionPicker value={actions} onChange={v => {
                    setActions(v);
                    setPage(0);
                }}/>
                <input value={participant} inputMode="numeric" aria-label={t("adminLogs.participant")} placeholder={t("adminLogs.participantPlaceholder")}
                       onChange={e => {
                           setParticipant(e.target.value);
                           setPage(0);
                       }}
                       className={cx(input, "w-[210px] font-mono", participant && !id && "border-rdt")}/>
                <span className="flex items-center gap-1.5">
                    <input type="date" value={from} max={to || undefined} aria-label={t("adminLogs.from")} className={input}
                           onChange={e => {
                               setFrom(e.target.value);
                               setPage(0);
                           }}/>
                    <span className="text-mu" aria-hidden="true">—</span>
                    <input type="date" value={to} min={from || undefined} aria-label={t("adminLogs.to")} className={input}
                           onChange={e => {
                               setTo(e.target.value);
                               setPage(0);
                           }}/>
                </span>
                {filtered && (
                    <button type="button" onClick={reset} className="h-[38px] rounded-[10px] px-3 text-[13px] font-semibold text-prt hover:bg-prs">
                        {t("adminLogs.clear")}
                    </button>
                )}
            </div>

            {error ? (
                <ErrorState title={t("adminLogs.loadError")} text={error.message} code={error.code} onRetry={() => setReloadKey(k => k + 1)}/>
            ) : (
                <div className="overflow-hidden rounded-[14px] border border-bd bg-sf">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] border-collapse text-[13px]">
                            <caption className="sr-only">{t("adminLogs.title")}</caption>
                            <thead>
                            <tr className="border-b border-bd bg-s2 text-left text-xs font-semibold text-mu">
                                <th scope="col" className="w-9 px-3 py-2.5"><span className="sr-only">{t("adminLogs.expand")}</span></th>
                                <th scope="col" className="w-[150px] px-3 py-2.5">{t("adminLogs.col.time")} ↓</th>
                                <th scope="col" className="w-[200px] px-3 py-2.5">{t("adminLogs.col.action")}</th>
                                <th scope="col" className="w-[190px] px-3 py-2.5">{t("adminLogs.col.who")}</th>
                                <th scope="col" className="px-3 py-2.5">{t("adminLogs.col.target")}</th>
                                <th scope="col" className="px-3 py-2.5">{t("adminLogs.col.details")}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading ? [...Array(8)].map((_, i) => (
                                <tr key={i} className="border-b border-bd last:border-0">
                                    <td colSpan={6} className="px-3 py-2.5"><Skeleton className="h-5 rounded"/></td>
                                </tr>
                            )) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-5">
                                        <EmptyState title={t("ui.nothingFound")} text={filtered ? t("adminLogs.emptyFiltered") : t("adminLogs.empty")}
                                                    action={filtered ? <button type="button" className="font-semibold text-prt hover:underline" onClick={reset}>{t("ui.resetFilters")}</button> : undefined}/>
                                    </td>
                                </tr>
                            ) : rows.map(e => {
                                const expandable = e.diff.length > 0;
                                const isOpen = open.has(e.id);
                                const who = e.actorUsername ?? (e.actorDiscordId ? e.actorDiscordId : t("adminLogs.system"));
                                return (
                                    <Fragment key={e.id}>
                                        <tr className={cx("border-b border-bd align-top last:border-0", isOpen && "bg-prs", fresh.has(e.id) && !isOpen && "bg-gnb/40")}>
                                            <td className="px-3 py-2.5">
                                                {expandable && (
                                                    <button type="button" onClick={() => toggle(e.id)} aria-expanded={isOpen}
                                                            aria-label={t(isOpen ? "adminLogs.collapse" : "adminLogs.expand")}
                                                            className="grid h-6 w-6 place-items-center rounded text-mu hover:bg-s2 hover:text-tx">
                                                        {isOpen ? <FiChevronDown size={14} aria-hidden="true"/> : <FiChevronRight size={14} aria-hidden="true"/>}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-mu">
                                                {time(e.createdAt)}
                                                {e.lastAt && <span className="block">→ {time(e.lastAt)}</span>}
                                                {e.count > 1 && <span className="mt-0.5 block font-sans">{t("guildAudit.edits", {count: e.count})}</span>}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", BADGE[CATEGORY[e.action] ?? "sys"])}>
                                                    {t(`logs.actions.${e.action}`, {defaultValue: e.action})}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <Avatar name={who} src={e.actorAvatarUrl} size={22}/>
                                                    <span className="truncate">{who}</span>
                                                </span>
                                            </td>
                                            <td className="max-w-[220px] truncate px-3 py-2.5" title={e.targetId ?? undefined}>{e.targetName ?? e.targetId ?? "—"}</td>
                                            <td className="px-3 py-2.5 text-mu">
                                                <span className="line-clamp-2 whitespace-pre-line break-words">
                                                    {expandable ? t("adminLogs.changedFields", {count: e.diff.length}) : e.details ?? "—"}
                                                </span>
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="border-b border-bd bg-prs/40">
                                                <td/>
                                                <td colSpan={5} className="px-3 pb-3.5 pt-1">
                                                    <DiffTable rows={e.diff}/>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                    <Pagination page={page} pageCount={data?.key === key ? data.pages : 0} total={data?.total ?? 0} onPageChange={setPage}/>
                </div>
            )}
        </div>
    );
}

/** «Поле · Было · Стало» (AdminLogs.dc.html); narrow screens fall back to the − / + lines. */
function DiffTable({rows}: { rows: AuditLogEntry["diff"] }) {
    const {t} = useTranslation();
    return (
        <>
            <table className="hidden w-full border-collapse overflow-hidden rounded-[10px] border border-bd font-mono text-xs md:table">
                <thead>
                <tr className="bg-s2 text-left font-sans font-semibold text-mu">
                    <th scope="col" className="w-[30%] px-2.5 py-1.5">{t("adminLogs.diff.field")}</th>
                    <th scope="col" className="w-[35%] px-2.5 py-1.5">{t("adminLogs.diff.before")}</th>
                    <th scope="col" className="w-[35%] px-2.5 py-1.5">{t("adminLogs.diff.after")}</th>
                </tr>
                </thead>
                <tbody>
                {rows.map(r => (
                    <tr key={r.field} className="border-t border-bd align-top">
                        <td className="break-all px-2.5 py-1.5 font-semibold">{r.field}</td>
                        <td className="break-all bg-rdb px-2.5 py-1.5 text-rdt">{r.before != null ? <><span aria-hidden="true">− </span>{r.before}</> : "—"}</td>
                        <td className="break-all bg-gnb px-2.5 py-1.5 text-gnt">{r.after != null ? <><span aria-hidden="true">+ </span>{r.after}</> : "—"}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            <DiffView rows={rows} className="md:hidden"/>
        </>
    );
}

/** «Действие: Бан, Роли изменены… 3» — a multi-select of the action types (ТЗ 6.5). */
function ActionPicker({value, onChange}: { value: AuditAction[]; onChange: (v: AuditAction[]) => void }) {
    const {t} = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
        const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", esc);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", esc);
        };
    }, [open]);
    const label = value.length === 0 ? t("adminLogs.anyAction")
        : value.slice(0, 2).map(a => t(`logs.actions.${a}`)).join(", ") + (value.length > 2 ? "…" : "");
    return (
        <div ref={ref} className="relative">
            <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}
                    className={cx("flex h-[38px] max-w-[360px] items-center gap-2 rounded-[10px] border px-3 text-[13px]",
                        value.length ? "border-pr bg-prs text-prt" : "border-bd bg-sf text-tx")}>
                <span className="text-mu">{t("adminLogs.action")}:</span>
                <span className="truncate font-semibold">{label}</span>
                {value.length > 0 && <span className="rounded-full bg-pr px-1.5 text-[11px] font-bold text-white">{value.length}</span>}
                <FiChevronDown size={14} aria-hidden="true"/>
            </button>
            {open && (
                <div role="group" aria-label={t("adminLogs.action")}
                     className="absolute left-0 top-[42px] z-30 flex max-h-[360px] w-[280px] flex-col overflow-y-auto rounded-[12px] border border-bd bg-sf p-1.5 shadow-popover">
                    {ACTIONS.map(a => (
                        <label key={a} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-s2">
                            <input type="checkbox" className="h-4 w-4 accent-pr" checked={value.includes(a)}
                                   onChange={() => onChange(value.includes(a) ? value.filter(x => x !== a) : [...value, a])}/>
                            <span className={cx("h-2 w-2 flex-none rounded-full", BADGE[CATEGORY[a]].split(" ")[0])} aria-hidden="true"/>
                            {t(`logs.actions.${a}`)}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}
