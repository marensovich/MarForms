import {useEffect, useRef, useState} from "react";
import {getAuditLogs} from "../../api/logs";
import type {AuditAction, AuditLogEntry} from "../../types/logs";
import {TabSkeleton} from "./shared";
import {useTranslation} from "react-i18next";
import {
    FiAlertOctagon,
    FiChevronDown,
    FiChevronLeft,
    FiChevronRight,
    FiFilter,
    FiRefreshCw,
    FiUser,
    FiX,
} from "react-icons/fi";

// ── Action metadata ──────────────────────────────────────────────────────────

interface ActionMeta {
    label: string;
    bg: string;
    text: string;
    border: string;
    dot: string;
}

const ACTION_META: Record<AuditAction, ActionMeta> = {
    USER_LOGIN: {
        label: "Login",
        bg: "bg-prs",
        text: "text-prt",
        border: "border-prs",
        dot: "bg-pr"
    },
    USER_BANNED: {
        label: "User Banned",
        bg: "bg-rdb",
        text: "text-rdt",
        border: "border-rdb",
        dot: "bg-dg"
    },
    USER_UNBANNED: {
        label: "User Unbanned",
        bg: "bg-gnb",
        text: "text-gnt",
        border: "border-gnb",
        dot: "bg-ok"
    },
    USER_ROLES_UPDATED: {
        label: "Roles Updated",
        bg: "bg-amb",
        text: "text-amt",
        border: "border-amb",
        dot: "bg-wr"
    },
    FORM_CREATED: {
        label: "Form Created",
        bg: "bg-gnb",
        text: "text-gnt",
        border: "border-gnb",
        dot: "bg-ok"
    },
    FORM_UPDATED: {
        label: "Form Updated",
        bg: "bg-prs",
        text: "text-prt",
        border: "border-prs",
        dot: "bg-pr"
    },
    FORM_DELETED: {
        label: "Form Deleted",
        bg: "bg-rdb",
        text: "text-rdt",
        border: "border-rdb",
        dot: "bg-dg"
    },
    SUBMISSION_CREATED: {
        label: "Submission Created",
        bg: "bg-gnb",
        text: "text-gnt",
        border: "border-gnb",
        dot: "bg-ok"
    },
    SUBMISSION_DELETED: {
        label: "Submission Deleted",
        bg: "bg-rdb",
        text: "text-rdt",
        border: "border-rdb",
        dot: "bg-dg"
    },
    SUBMISSION_DECIDED: {
        label: "Submission Decided",
        bg: "bg-prs",
        text: "text-prt",
        border: "border-prs",
        dot: "bg-pr"
    },
    SUBMISSION_DM_FAILED: {
        label: "Decision DM Not Delivered",
        bg: "bg-amb",
        text: "text-amt",
        border: "border-amb",
        dot: "bg-wr"
    },
    ROLE_CREATED: {
        label: "Role Created",
        bg: "bg-gnb",
        text: "text-gnt",
        border: "border-gnb",
        dot: "bg-ok"
    },
    ROLE_UPDATED: {
        label: "Role Updated",
        bg: "bg-prs",
        text: "text-prt",
        border: "border-prs",
        dot: "bg-pr"
    },
    ROLE_DELETED: {
        label: "Role Deleted",
        bg: "bg-rdb",
        text: "text-rdt",
        border: "border-rdb",
        dot: "bg-dg"
    },
    SETTINGS_UPDATED: {
        label: "Settings Updated",
        bg: "bg-amb",
        text: "text-amt",
        border: "border-amb",
        dot: "bg-wr"
    },
    MODERATOR_ADDED: {
        label: "Moderator Added",
        bg: "bg-gnb",
        text: "text-gnt",
        border: "border-gnb",
        dot: "bg-ok"
    },
    MODERATOR_REMOVED: {
        label: "Moderator Removed",
        bg: "bg-rdb",
        text: "text-rdt",
        border: "border-rdb",
        dot: "bg-dg"
    },
    GUILD_BAN_ADDED: {
        label: "Server Ban Added",
        bg: "bg-rdb",
        text: "text-rdt",
        border: "border-rdb",
        dot: "bg-dg"
    },
    GUILD_BAN_REMOVED: {
        label: "Server Ban Removed",
        bg: "bg-gnb",
        text: "text-gnt",
        border: "border-gnb",
        dot: "bg-ok"
    },
    GUILD_CONNECTED: {
        label: "Server Connected",
        bg: "bg-prs",
        text: "text-prt",
        border: "border-prs",
        dot: "bg-pr"
    },
    GUILD_ROLE_REVOKED: {
        label: "Server Role Revoked",
        bg: "bg-rdb",
        text: "text-rdt",
        border: "border-rdb",
        dot: "bg-dg"
    },
    FORM_STATUS_CHANGED: {
        label: "Form Status Changed",
        bg: "bg-prs",
        text: "text-prt",
        border: "border-prs",
        dot: "bg-pr"
    },
    BOT_REMOVED: {
        label: "Bot Removed",
        bg: "bg-rdb",
        text: "text-rdt",
        border: "border-rdb",
        dot: "bg-dg"
    },
    BOT_RECONNECTED: {
        label: "Bot Reconnected",
        bg: "bg-gnb",
        text: "text-gnt",
        border: "border-gnb",
        dot: "bg-ok"
    },
    BOT_PERMISSIONS_MISSING: {
        label: "Bot Lacks Permissions",
        bg: "bg-amb",
        text: "text-amt",
        border: "border-amb",
        dot: "bg-wr"
    },
    WEBHOOK_FAILING: {
        label: "Webhook Failing",
        bg: "bg-amb",
        text: "text-amt",
        border: "border-amb",
        dot: "bg-wr"
    },
};

const ALL_ACTIONS = Object.keys(ACTION_META) as AuditAction[];
const PAGE_SIZE = 25;

function DiffLine({line}: { line: string }) {
    // Detect pattern:  SomeLabel: "old" → "new"
    // Arrow separator is  →  (with spaces)
    const arrowIdx = line.indexOf(" → ");
    if (arrowIdx === -1) {
        return <p className="text-xs text-mu font-mono">{line}</p>;
    }

    const colonIdx = line.indexOf(": ");
    const label = colonIdx !== -1 ? line.substring(0, colonIdx) : "";
    const rest = colonIdx !== -1 ? line.substring(colonIdx + 2) : line;
    const [before, ...afterParts] = rest.split(" → ");
    const after = afterParts.join(" → "); // rejoin in case value itself had →

    return (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-xs">
            {label && (
                <span className="text-mu shrink-0">{label}:</span>
            )}
            <span className="text-rdt line-through break-all">{before}</span>
            <span className="text-mu shrink-0">→</span>
            <span className="text-gnt break-all">{after}</span>
        </div>
    );
}

function DiffBlock({details}: { details: string }) {
    const lines = details.split("\n").filter(l => l.trim());
    return (
        <div className="flex flex-col gap-1.5 rounded-lg border border-bd bg-s2 px-4 py-3">
            {lines.map((line, i) => <DiffLine key={i} line={line}/>)}
        </div>
    );
}

// ── Action badge ──────────────────────────────────────────────────────────────

function ActionBadge({action}: { action: AuditAction }) {
    const {t} = useTranslation();
    const m = ACTION_META[action];
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${m.bg} ${m.text} ${m.border}`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.dot}`}/>
            {t(`logs.actions.${action}`)}
        </span>
    );
}

// ── Single log row ────────────────────────────────────────────────────────────

function LogRow({entry}: { entry: AuditLogEntry }) {
    const [open, setOpen] = useState(false);
    const hasDetails = !!(entry.details?.trim());

    const date = new Date(entry.createdAt);
    const timeStr = date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"});
    const dateStr = date.toLocaleDateString([], {day: "2-digit", month: "2-digit", year: "numeric"});

    // First line of details for compact preview
    const previewLine = hasDetails ? entry.details!.split("\n")[0].trim() : null;

    return (
        <div className="border-b border-bd last:border-0">
            {/* Main row */}
            <div
                className={`grid grid-cols-[110px_148px_180px_180px_1fr_28px] items-start gap-3 px-4 py-3 text-sm transition-colors ${hasDetails ? "cursor-pointer hover:bg-bg" : "hover:bg-bg"}`}
                onClick={hasDetails ? () => setOpen(o => !o) : undefined}
            >
                {/* Timestamp */}
                <div className="flex flex-col pt-0.5">
                    <span className="font-mono text-xs text-mu tabular-nums">{timeStr}</span>
                    <span className="text-[10px] text-mu tabular-nums">{dateStr}</span>
                </div>

                {/* Action */}
                <div className="pt-0.5">
                    <ActionBadge action={entry.action}/>
                </div>

                {/* Actor */}
                <div className="flex flex-col min-w-0 pt-0.5">
                    <span className="truncate text-xs font-medium text-mu">
                        {entry.actorUsername ?? <span className="text-mu/70">Unknown</span>}
                    </span>
                    {entry.actorDiscordId && (
                        <span className="truncate font-mono text-[10px] text-mu">{entry.actorDiscordId}</span>
                    )}
                </div>

                {/* Target */}
                <div className="flex flex-col min-w-0 pt-0.5">
                    {entry.targetName
                        ? <span className="truncate text-xs text-mu">{entry.targetName}</span>
                        : entry.targetId
                            ? <span className="truncate font-mono text-[10px] text-mu">{entry.targetId}</span>
                            : <span className="text-xs text-mu/70">—</span>
                    }
                    {entry.targetName && entry.targetId && (
                        <span className="truncate font-mono text-[10px] text-mu/70">{entry.targetId}</span>
                    )}
                </div>

                {/* Details preview */}
                <div className="min-w-0 pt-0.5">
                    {previewLine ? (
                        <span className="block truncate text-xs text-mu">{previewLine}</span>
                    ) : (
                        <span className="text-xs text-mu/70">—</span>
                    )}
                </div>

                {/* Expand toggle */}
                <div className="flex items-center justify-center pt-1">
                    {hasDetails && (
                        <FiChevronDown
                            size={13}
                            className={`text-mu transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                        />
                    )}
                </div>
            </div>

            {/* Expanded diff section */}
            {open && hasDetails && (
                <div className="px-4 pb-3">
                    <DiffBlock details={entry.details!}/>
                </div>
            )}
        </div>
    );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function LogsTab() {
    const {t} = useTranslation();
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [filterAction, setFilterAction] = useState<AuditAction | "">("");
    const [filterActor, setFilterActor] = useState("");
    const [autoRefresh, setAutoRefresh] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const load = (p: number, action: AuditAction | "", actor: string) => {
        setLoading(true);
        const actorId = /^\d+$/.test(actor.trim()) ? actor.trim() : undefined;
        getAuditLogs(p, PAGE_SIZE, action || undefined, actorId)
            .then(data => {
                setEntries(data.content);
                setTotalPages(data.totalPages);
                setTotalElements(data.totalElements);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load(page, filterAction, filterActor);
    }, [page, filterAction]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (autoRefresh) {
            intervalRef.current = setInterval(() => load(page, filterAction, filterActor), 10_000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [autoRefresh, page, filterAction, filterActor]);

    const applyActorFilter = () => {
        setPage(0);
        load(0, filterAction, filterActor);
    };
    const clearFilters = () => {
        setFilterAction("");
        setFilterActor("");
        setPage(0);
        load(0, "", "");
    };
    const hasFilters = filterAction !== "" || filterActor.trim() !== "";

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-tx">{t("logs.title")}</h1>
                    <p className="mt-0.5 text-sm text-mu">
                        {t("logs.subtitle")}
                        {totalElements > 0 && (
                            <span className="ml-2 text-mu">· {t("logs.entries", {count: totalElements.toLocaleString()})}</span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAutoRefresh(p => !p)}
                        title="Auto-refresh every 10 s"
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                            autoRefresh
                                ? "border-gnb bg-gnb text-gnt"
                                : "border-bd bg-sf text-mu hover:text-tx"
                        }`}
                    >
                        <FiRefreshCw size={12} className={autoRefresh ? "animate-spin" : ""}/>
                        {t("logs.live")}
                    </button>
                    <button
                        onClick={() => load(page, filterAction, filterActor)}
                        className="flex items-center gap-1.5 rounded-lg border border-bd bg-sf px-3 py-2 text-xs font-medium text-mu transition-colors hover:text-tx"
                    >
                        <FiRefreshCw size={12}/>
                        {t("logs.refresh")}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div
                    className="flex items-center gap-2 rounded-xl border border-bd bg-sf px-3 py-2">
                    <FiFilter size={12} className="text-mu shrink-0"/>
                    <select
                        value={filterAction}
                        onChange={e => {
                            setFilterAction(e.target.value as AuditAction | "");
                            setPage(0);
                        }}
                        className="bg-transparent text-sm text-mu outline-none"
                    >
                        <option value="">{t("logs.allActions")}</option>
                        {ALL_ACTIONS.map(a => (
                            <option key={a} value={a}>{t(`logs.actions.${a}`)}</option>
                        ))}
                    </select>
                </div>

                <div
                    className="flex items-center gap-2 rounded-xl border border-bd bg-sf px-3 py-2">
                    <FiUser size={12} className="text-mu shrink-0"/>
                    <input
                        type="text"
                        placeholder={t("logs.discordIdFilter")}
                        value={filterActor}
                        onChange={e => setFilterActor(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && applyActorFilter()}
                        className="w-40 bg-transparent text-sm text-mu placeholder-mu/70 outline-none"
                    />
                    {filterActor && (
                        <button onClick={() => {
                            setFilterActor("");
                            load(page, filterAction, "");
                        }}>
                            <FiX size={12} className="text-mu hover:text-tx"/>
                        </button>
                    )}
                </div>

                {hasFilters && (
                    <button onClick={clearFilters} className="text-xs text-mu underline hover:text-mu">
                        {t("logs.clearFilters")}
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-bd bg-sf overflow-hidden">
                {/* Column headers */}
                <div
                    className="grid grid-cols-[110px_148px_180px_180px_1fr_28px] gap-3 border-b border-bd bg-bg px-4 py-2.5">
                    {[t("logs.columns.time"), t("logs.columns.action"), t("logs.columns.actor"), t("logs.columns.target"), t("logs.columns.details"), ""].map((h, i) => (
                        <span key={i} className="text-[10px] font-semibold uppercase tracking-wider text-mu">
                            {h}
                        </span>
                    ))}
                </div>

                {loading ? (
                    <div className="py-12"><TabSkeleton/></div>
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-mu/70">
                        <FiAlertOctagon size={30}/>
                        <p className="text-sm">{t("logs.noLogs")}</p>
                        {hasFilters && (
                            <button onClick={clearFilters} className="text-xs text-prt hover:text-prt">
                                {t("logs.clearFilters")}
                            </button>
                        )}
                    </div>
                ) : (
                    <div>
                        {entries.map(entry => <LogRow key={entry.id} entry={entry}/>)}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2">
                {(["FORM_CREATED", "FORM_DELETED", "FORM_UPDATED", "SETTINGS_UPDATED"] as AuditAction[]).map(a => {
                    const m = ACTION_META[a];
                    return (
                        <div key={a} className="flex items-center gap-1.5 text-[10px] text-mu">
                            <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`}/>
                            {t(`logs.actions.${a}`)}
                        </div>
                    );
                })}
                <span className="text-[10px] text-mu/70">{t("logs.expandHint")}</span>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-mu">
                        {t("logs.pagination.page", {page: page + 1, total: totalPages})}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(p => p - 1)}
                            disabled={page === 0}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-bd bg-sf text-mu transition-colors hover:text-tx disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <FiChevronLeft size={14}/>
                        </button>

                        {Array.from({length: Math.min(totalPages, 7)}, (_, i) => {
                            const p = totalPages <= 7 ? i
                                : page < 4 ? i
                                    : page > totalPages - 5 ? totalPages - 7 + i
                                        : page - 3 + i;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`h-8 min-w-[32px] rounded-lg border px-2 text-xs font-medium transition-colors ${
                                        p === page
                                            ? "border-prs bg-prs text-prt"
                                            : "border-bd bg-sf text-mu hover:text-tx"
                                    }`}
                                >
                                    {p + 1}
                                </button>
                            );
                        })}

                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= totalPages - 1}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-bd bg-sf text-mu transition-colors hover:text-tx disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <FiChevronRight size={14}/>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
