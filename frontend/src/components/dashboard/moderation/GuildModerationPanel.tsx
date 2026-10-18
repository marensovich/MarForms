import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {useSearchParams} from "react-router-dom";
import {FiChevronLeft, FiChevronRight, FiSearch} from "react-icons/fi";
import {type DashboardForm, getGuildForms, type MyGuild} from "../../../api/dashboard";
import {getGuildSubmissions, type ModerationSubmission, type SubmissionStatus} from "../../../api/moderation";
import {describeApiError} from "../../../api/errors";
import {Avatar, cx, EmptyState, ErrorState, pageList, Skeleton} from "../../../ui";
import FilterSelect from "./FilterSelect";
import {useIsMobile} from "../../../shell/useIsMobile";
import SubmissionCardModal from "./SubmissionCardModal";
import {SubmissionStatusBadge} from "./SubmissionStatusBadge";

// Docs: docs/design/mockups/WsSubmissions.dc.html, DarkModeration, R1024Moderation; ТЗ 4.5.

const PAGE_SIZE = 20;
const STATUSES: SubmissionStatus[] = ["PENDING", "NEEDS_REVISION", "APPROVED", "REJECTED"];
/** ?status=all shows every status; no ?status means the default, «На рассмотрении» (ФТ-4.5.1). */
const ALL = "all";

/**
 * A server's moderation queue (ТЗ 4.5): status, form and author filters kept
 * in the URL, the submissions table with paging, and the card. Decisions patch
 * the row in place — no reload of the list.
 */
export default function GuildModerationPanel({guild}: { guild: MyGuild }) {
    const {t, i18n} = useTranslation();
    const [params, setParams] = useSearchParams();
    const mobile = useIsMobile();
    const statusParam = params.get("status");
    const status: SubmissionStatus | "" = statusParam === ALL ? ""
        : STATUSES.includes(statusParam as SubmissionStatus) ? statusParam as SubmissionStatus : "PENDING";
    const formId = params.get("form") ?? "";
    const query = params.get("q") ?? "";
    const page = Math.max(0, Number(params.get("page") ?? 1) - 1) || 0;
    // ?submission=<id> (⌘K search, a notification, prev/next) is the open card.
    const openId = params.get("submission");

    const [forms, setForms] = useState<DashboardForm[]>([]);
    const [result, setResult] = useState<{ key: string; rows: ModerationSubmission[]; total: number; pages: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [queryInput, setQueryInput] = useState(query);
    const [lastQuery, setLastQuery] = useState(query);
    if (query !== lastQuery) {
        setLastQuery(query);
        setQueryInput(query);
    }

    const update = (patch: Record<string, string | null>, resetPage = true) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            Object.entries(patch).forEach(([k, v]) => v === null || v === "" ? next.delete(k) : next.set(k, v));
            if (resetPage) next.delete("page");
            return next;
        }, {replace: true});
    };

    // The search box writes to the URL once typing pauses.
    useEffect(() => {
        const trimmed = queryInput.trim();
        if (trimmed === query) return;
        const id = setTimeout(() => update({q: trimmed}), 350);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- update only writes the URL
    }, [queryInput, query]);

    useEffect(() => {
        getGuildForms(guild.guildId, true).then(p => setForms(p.content)).catch(() => setForms([]));
    }, [guild.guildId]);

    const key = `${guild.guildId}|${status}|${formId}|${query}|${page}|${reloadKey}`;
    useEffect(() => {
        let cancelled = false;
        getGuildSubmissions(guild.guildId, {
            status: status || undefined, formId: formId || undefined, query: query || undefined, page, size: PAGE_SIZE,
        })
            .then(r => {
                if (cancelled) return;
                setResult({key, rows: r.content, total: r.page.totalElements, pages: r.page.totalPages});
                setError(null);
            })
            .catch(e => !cancelled && setError(describeApiError(e, t("moderation.loadError"))));
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, status, formId, query, page, key, t]);

    const loading = !error && result?.key !== key;
    const rows = result?.rows ?? [];
    const total = result?.total ?? 0;
    const pages = result?.pages ?? 0;
    const filtered = statusParam !== null || formId !== "" || query !== "";
    const openIndex = rows.findIndex(r => r.id === openId);
    const open = (id: string | null) => update({submission: id}, false);

    const onDecided = (updated: ModerationSubmission) => {
        setResult(r => r && {
            ...r,
            rows: r.rows.map(row => row.id === updated.id
                ? {...row, ...updated, discordUsername: row.discordUsername, formTitle: row.formTitle,
                    moderatorUsername: updated.moderatorUsername ?? null}
                : row),
        });
    };

    const pageBtn = "grid h-[34px] min-w-[34px] place-items-center rounded-[10px] px-1 tabular-nums";

    return (
        <div className="flex flex-col gap-4 pt-6">
            <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex h-10 flex-[1_1_280px] items-center gap-2 rounded-xl border border-bd bg-sf px-3 text-mu focus-within:border-pr">
                    <FiSearch size={16} aria-hidden="true"/>
                    <input value={queryInput} onChange={e => setQueryInput(e.target.value)}
                           onKeyDown={e => e.key === "Enter" && update({q: queryInput.trim()})}
                           placeholder={t("moderation.filter.searchPlaceholder")} aria-label={t("moderation.filter.searchPlaceholder")}
                           className="min-w-0 flex-1 border-0 bg-transparent text-sm text-tx outline-none placeholder:text-mu"/>
                </label>
                <FilterSelect label={t("moderation.columns.status")} value={status || ALL}
                              onChange={v => update({status: v === "PENDING" ? null : v})}>
                    {STATUSES.map(s => <option key={s} value={s}>{t(`moderation.status.${s}`)}</option>)}
                    <option value={ALL}>{t("moderation.filter.allStatuses")}</option>
                </FilterSelect>
                <FilterSelect label={t("moderation.columns.form")} value={formId} onChange={v => update({form: v})}>
                    <option value="">{t("moderation.filter.allForms")}</option>
                    {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                </FilterSelect>
                <button type="button" disabled={!filtered}
                        onClick={() => {
                            setQueryInput("");
                            update({status: null, form: null, q: null});
                        }}
                        className="h-10 rounded-xl px-3 text-sm font-medium text-prt hover:bg-prs disabled:text-mu disabled:hover:bg-transparent">
                    {t("moderation.filter.reset")}
                </button>
            </div>

            {error ? (
                <ErrorState title={t("moderation.loadError")} text={error} onRetry={() => setReloadKey(k => k + 1)}
                            retryLabel={t("ui.retry")}/>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-bd bg-sf">
                    {/* On a phone the queue is a list of cards (ТЗ 4.10); the card opens full screen. */}
                    {mobile ? (
                        <QueueCards rows={rows} loading={loading} onOpen={open}/>
                    ) : (
                    <table className="w-full min-w-[860px] border-collapse text-sm" aria-busy={loading || undefined}>
                        <thead>
                        <tr className="text-left text-xs text-mu">
                            {(["author", "form", "submitted", "status", "moderator"] as const).map(c => (
                                <th key={c} className="border-b border-bd px-4 py-3 font-semibold">{t(`moderation.columns.${c}`)}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {loading ? [0, 1, 2, 3, 4].map(i => (
                            <tr key={i}>
                                {[0, 1, 2, 3, 4].map(j => (
                                    <td key={j} className="border-b border-bd px-4 py-3.5"><Skeleton className="h-3 w-3/5"/></td>
                                ))}
                            </tr>
                        )) : rows.map(r => {
                            const name = r.discordUsername ?? (r.discordId ? t("moderation.unknownUser") : t("moderation.anonymous"));
                            return (
                                <tr key={r.id} tabIndex={0} onClick={() => open(r.id)}
                                    onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open(r.id))}
                                    aria-selected={r.id === openId}
                                    className={cx("cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pr",
                                        r.id === openId ? "bg-prs" : "hover:bg-bg")}>
                                    <td className="border-b border-bd px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <Avatar name={r.discordUsername ?? r.discordId ?? "?"} size={34}/>
                                            <div className="flex min-w-0 flex-col gap-px">
                                                <span className="truncate font-semibold">{name}</span>
                                                {r.discordId && <span className="font-mono text-[11px] text-mu">{r.discordId}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="max-w-[260px] truncate border-b border-bd px-4 py-3">{r.formTitle ?? "—"}</td>
                                    <td className="whitespace-nowrap border-b border-bd px-4 py-3 text-mu">
                                        {new Date(r.createdAt).toLocaleString(i18n.language, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})}
                                    </td>
                                    <td className="border-b border-bd px-4 py-3"><SubmissionStatusBadge status={r.status}/></td>
                                    <td className="border-b border-bd px-4 py-3 text-mu">{r.moderatorUsername ?? "—"}</td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                    )}
                    {!loading && rows.length === 0 && (
                        <EmptyState className="m-4" title={t("moderation.empty")}
                                    text={filtered ? t("moderation.emptyFiltered") : t("moderation.emptyPending")}/>
                    )}
                    {!loading && total > 0 && (
                        <nav aria-label={t("ui.pagination")}
                             className="flex items-center justify-between px-4 py-3 text-[13px] text-mu">
                            <span>{t("moderation.range", {
                                from: page * PAGE_SIZE + 1, to: page * PAGE_SIZE + rows.length, total,
                            })}</span>
                            {pages > 1 && (
                                <div className="flex gap-1">
                                    <button type="button" aria-label={t("ui.prevPage")} disabled={page === 0}
                                            onClick={() => update({page: String(page)}, false)}
                                            className={cx(pageBtn, "border border-bd bg-sf text-tx disabled:text-mu")}>
                                        <FiChevronLeft size={16} aria-hidden="true"/>
                                    </button>
                                    {pageList(page + 1, pages).map((p, i) => p === "…"
                                        ? <span key={`gap-${i}`} className={pageBtn}>…</span>
                                        : (
                                            <button key={p} type="button" aria-current={p === page + 1 ? "page" : undefined}
                                                    onClick={() => update({page: p === 1 ? null : String(p)}, false)}
                                                    className={cx(pageBtn, p === page + 1 ? "bg-prs font-semibold text-prt" : "text-tx hover:bg-s2")}>
                                                {p}
                                            </button>
                                        ))}
                                    <button type="button" aria-label={t("ui.nextPage")} disabled={page >= pages - 1}
                                            onClick={() => update({page: String(page + 2)}, false)}
                                            className={cx(pageBtn, "border border-bd bg-sf text-tx disabled:text-mu")}>
                                        <FiChevronRight size={16} aria-hidden="true"/>
                                    </button>
                                </div>
                            )}
                        </nav>
                    )}
                </div>
            )}

            {openId && (
                <SubmissionCardModal
                    submissionId={openId}
                    onClose={() => open(null)}
                    onDecided={onDecided}
                    canReopen={guild.role === "OWNER"}
                    onPrev={openIndex > 0 ? () => open(rows[openIndex - 1].id) : undefined}
                    onNext={openIndex >= 0 && openIndex < rows.length - 1 ? () => open(rows[openIndex + 1].id) : undefined}
                />
            )}
        </div>
    );
}

/** The queue on a phone (ТЗ 4.10): one card per submission; a tap opens it full screen. */
function QueueCards({rows, loading, onOpen}: { rows: ModerationSubmission[]; loading: boolean; onOpen: (id: string) => void }) {
    const {t, i18n} = useTranslation();
    return (
        <ul className="m-0 flex list-none flex-col p-0" aria-busy={loading || undefined}>
            {loading ? [0, 1, 2].map(i => (
                <li key={i} className="border-b border-bd p-4"><Skeleton className="h-10 w-full rounded-lg"/></li>
            )) : rows.map(r => (
                <li key={r.id} className="border-b border-bd last:border-0">
                    <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-bg">
                        <Avatar name={r.discordUsername ?? r.discordId ?? "?"} size={38}/>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="truncate font-semibold">
                                {r.discordUsername ?? (r.discordId ? t("moderation.unknownUser") : t("moderation.anonymous"))}
                            </span>
                            <span className="truncate text-[13px] text-mu">
                                {r.formTitle ?? "—"} · {new Date(r.createdAt).toLocaleString(i18n.language,
                                {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})}
                            </span>
                        </span>
                        <SubmissionStatusBadge status={r.status}/>
                    </button>
                </li>
            ))}
        </ul>
    );
}
