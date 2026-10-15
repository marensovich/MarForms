import {useEffect, useState} from "react";
import {AnimatePresence} from "framer-motion";
import {useTranslation} from "react-i18next";
import {FiArrowLeft, FiChevronLeft, FiChevronRight, FiInbox, FiRefreshCw, FiSearch, FiX} from "react-icons/fi";
import {type DashboardForm, getGuildForms, getGuildModerators, type GuildModerator, type MyGuild} from "../../../api/dashboard";
import {
    getGuildSubmissions,
    type ModerationSubmission,
    type SubmissionStatus,
} from "../../../api/moderation";
import {describeApiError} from "../../../api/errors";
import {EmptyState, TabSkeleton} from "../shared";
import SubmissionCardModal from "./SubmissionCardModal";
import {SubmissionStatusBadge} from "./SubmissionStatusBadge";

const PAGE_SIZE = 20;
const STATUSES: SubmissionStatus[] = ["PENDING", "NEEDS_REVISION", "APPROVED", "REJECTED"];

interface Filters {
    formId: string;
    status: SubmissionStatus | "";
    query: string;
    /** Who decided (Discord ID). */
    moderator: string;
}

/**
 * A guild's submissions for its owner and moderators (task #55): filter by
 * form, status and author, open a card and decide. Decisions patch the row
 * in place — no reload of the list.
 */
export default function GuildModerationPanel({guild, onBack}: { guild: MyGuild; onBack: () => void }) {
    const {t} = useTranslation();
    const [forms, setForms] = useState<DashboardForm[]>([]);
    const [rows, setRows] = useState<ModerationSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<Filters>({formId: "", status: "PENDING", query: "", moderator: ""});
    const [moderators, setModerators] = useState<GuildModerator[]>([]);
    const [queryInput, setQueryInput] = useState("");
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);
    // ?submission=<id> (from the ⌘K search) opens that card straight away.
    const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("submission"));

    useEffect(() => {
        getGuildModerators(guild.guildId).then(setModerators).catch(() => setModerators([]));
    }, [guild.guildId]);

    useEffect(() => {
        getGuildForms(guild.guildId, true)
            .then(p => setForms(p.content))
            .catch(() => setForms([]));
    }, [guild.guildId]);

    useEffect(() => {
        let cancelled = false;
        getGuildSubmissions(guild.guildId, {
            formId: filters.formId || undefined,
            status: filters.status || undefined,
            query: filters.query || undefined,
            moderator: filters.moderator || undefined,
            page,
            size: PAGE_SIZE,
        })
            .then(r => {
                if (cancelled) return;
                setRows(r.content);
                setTotalPages(r.page.totalPages);
                setTotalElements(r.page.totalElements);
                setError(null);
            })
            .catch(e => {
                if (!cancelled) setError(describeApiError(e, t("moderation.loadError")));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, filters, page, reloadKey, t]);

    const updateFilters = (patch: Partial<Filters>) => {
        setLoading(true);
        setFilters(f => ({...f, ...patch}));
        setPage(0);
    };

    const applyQuery = () => updateFilters({query: queryInput.trim()});

    const onDecided = (updated: ModerationSubmission) => {
        setRows(list => list.map(r => r.id === updated.id
            ? {...r, ...updated, discordUsername: r.discordUsername, formTitle: r.formTitle,
                moderatorUsername: updated.moderatorUsername ?? null}
            : r));
    };

    return (
        <div>
            <button onClick={onBack}
                    className="mb-4 flex items-center gap-1.5 text-sm text-mu transition-colors hover:text-tx">
                <FiArrowLeft size={14}/>
                {t("servers.title")}
            </button>

            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-tx">{guild.guildName}</h1>
                    <p className="mt-0.5 text-sm text-mu">{t("moderation.subtitle", {count: totalElements})}</p>
                </div>
                <button
                    onClick={() => {
                        setLoading(true);
                        setReloadKey(k => k + 1);
                    }}
                    className="flex items-center gap-2 rounded-lg border border-bd bg-sf px-3 py-2 text-xs font-medium text-mu transition-colors hover:text-tx"
                >
                    <FiRefreshCw size={12}/>
                    {t("moderation.refresh")}
                </button>
            </div>

            {/* Status chips */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {(["", ...STATUSES] as const).map(s => (
                    <button
                        key={s || "all"}
                        onClick={() => updateFilters({status: s})}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            filters.status === s
                                ? "border-prs bg-prs text-prt"
                                : "border-bd bg-sf text-mu hover:text-tx"
                        }`}
                    >
                        {s ? t(`moderation.status.${s}`) : t("moderation.filter.allStatuses")}
                    </button>
                ))}
            </div>

            {/* Form + search */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <select
                    value={filters.formId}
                    onChange={e => updateFilters({formId: e.target.value})}
                    className="rounded-lg border border-bd bg-sf px-3 py-2 text-xs text-mu outline-none focus:border-pr"
                >
                    <option value="">{t("moderation.filter.allForms")}</option>
                    {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                </select>
                <select
                    value={filters.moderator}
                    onChange={e => updateFilters({moderator: e.target.value})}
                    aria-label={t("moderation.filter.moderator")}
                    className="rounded-lg border border-bd bg-sf px-3 py-2 text-xs text-mu outline-none focus:border-pr"
                >
                    <option value="">{t("moderation.filter.anyModerator")}</option>
                    {moderators.map(m => <option key={m.discordId} value={m.discordId}>{m.username}</option>)}
                </select>
                <div className="flex items-center gap-1.5 rounded-lg border border-bd bg-sf px-3 py-2">
                    <FiSearch size={12} className="flex-shrink-0 text-mu"/>
                    <input
                        value={queryInput}
                        onChange={e => setQueryInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && applyQuery()}
                        placeholder={t("moderation.filter.searchPlaceholder")}
                        className="w-48 bg-transparent text-xs text-tx placeholder-mu/70 outline-none"
                    />
                    {queryInput && (
                        <button onClick={() => {
                            setQueryInput("");
                            updateFilters({query: ""});
                        }} className="text-mu transition-colors hover:text-tx">
                            <FiX size={11}/>
                        </button>
                    )}
                </div>
                <button onClick={applyQuery}
                        className="rounded-lg bg-pr px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-prh">
                    {t("common.search")}
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-rdb bg-rdb px-3 py-2 text-xs text-rdt">
                    {error}
                </div>
            )}

            {loading ? (
                <TabSkeleton rows={5}/>
            ) : rows.length === 0 ? (
                <EmptyState message={t("moderation.empty")} icon={<FiInbox/>}/>
            ) : (
                <div className="overflow-hidden rounded-xl border border-bd bg-sf">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-bd text-left text-xs uppercase tracking-wider text-mu">
                            <th className="px-5 py-3 font-medium">{t("moderation.columns.author")}</th>
                            <th className="px-5 py-3 font-medium">{t("moderation.columns.form")}</th>
                            <th className="px-5 py-3 font-medium">{t("moderation.columns.submitted")}</th>
                            <th className="px-5 py-3 font-medium">{t("moderation.columns.status")}</th>
                            <th className="px-5 py-3 font-medium">{t("moderation.columns.moderator")}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map(r => (
                            <tr key={r.id} onClick={() => setOpenId(r.id)}
                                className="cursor-pointer border-b border-bd transition-colors last:border-0 hover:bg-bg">
                                <td className="px-5 py-3">
                                    <p className="font-medium text-tx">
                                        {r.discordUsername ?? (r.discordId ? t("moderation.unknownUser") : t("moderation.anonymous"))}
                                    </p>
                                    {r.discordId && <p className="font-mono text-[11px] text-mu">{r.discordId}</p>}
                                </td>
                                <td className="max-w-[220px] truncate px-5 py-3 text-mu">{r.formTitle ?? "—"}</td>
                                <td className="px-5 py-3 text-xs text-mu">{new Date(r.createdAt).toLocaleString()}</td>
                                <td className="px-5 py-3">
                                    <SubmissionStatusBadge status={r.status}/>
                                    {r.moderatorComment && (
                                        <p className="mt-1 max-w-[220px] truncate text-[11px] text-mu"
                                           title={r.moderatorComment}>
                                            {r.moderatorComment}
                                        </p>
                                    )}
                                </td>
                                <td className="px-5 py-3 text-xs text-mu">{r.moderatorUsername ?? "—"}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-mu">
                        {t("responses.pagination.info", {page: page + 1, total: totalPages, elements: totalElements})}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => {
                                setLoading(true);
                                setPage(p => Math.max(0, p - 1));
                            }}
                            disabled={page === 0}
                            className="flex items-center gap-1 rounded-lg border border-bd px-3 py-1.5 text-xs text-mu transition-colors hover:text-tx disabled:cursor-not-allowed disabled:opacity-30"
                        >
                            <FiChevronLeft size={13}/> {t("responses.pagination.prev")}
                        </button>
                        <button
                            onClick={() => {
                                setLoading(true);
                                setPage(p => Math.min(totalPages - 1, p + 1));
                            }}
                            disabled={page >= totalPages - 1}
                            className="flex items-center gap-1 rounded-lg border border-bd px-3 py-1.5 text-xs text-mu transition-colors hover:text-tx disabled:cursor-not-allowed disabled:opacity-30"
                        >
                            {t("responses.pagination.next")} <FiChevronRight size={13}/>
                        </button>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {openId && (
                    <SubmissionCardModal
                        submissionId={openId}
                        onClose={() => setOpenId(null)}
                        onDecided={onDecided}
                        canReopen={guild.role === "OWNER"}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
