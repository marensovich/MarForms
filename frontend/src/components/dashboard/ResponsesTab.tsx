import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {FiArrowRight, FiEye, FiSearch, FiTrash2, FiX} from "react-icons/fi";
import {ApiError, apiRequest} from "../../api/client";
import {describeApiError} from "../../api/errors";
import {getSubmissionDetail, type SubmissionDetail, type SubmissionStatus} from "../../api/moderation";
import {Avatar, ConfirmDialog, cx, DataTable, EmptyState, KpiCard, SegmentedControl, Skeleton, type SortState, useToast} from "../../ui";
import FilterSelect from "./moderation/FilterSelect";
import Attachment from "./moderation/Attachment";
import {SubmissionStatusBadge} from "./moderation/SubmissionStatusBadge";
import {formatAnswer} from "../submission/formatAnswer";

// Docs: docs/design/mockups/AdminResponses.dc.html, AdminRespByUser.dc.html; ТЗ 6.2.

interface Row {
    submission: {
        id: string;
        formId: string;
        discordId: string | null;
        createdAt: string;
        status: SubmissionStatus;
        discordUsername: string | null;
        formTitle: string | null;
    };
    guildId: string | null;
    guildName: string | null;
    avatarUrl: string | null;
    answered: number;
    fields: number;
}

interface UserRow {
    discordId: string;
    username: string | null;
    avatarUrl: string | null;
    submissions: number;
    forms: number;
    last: string;
}

interface Stats {
    total: number;
    lastWeek: number;
    forms: number;
    activeForms: number;
    users: number;
}

interface Page<T> {
    content: T[];
    page: { totalElements: number; totalPages: number };
}

type View = "all" | "users";
const PAGE_SIZE = 25;

/**
 * Платформа · Заявки (ТЗ 6.2, RESPONSES_MANAGE): KPIs, «Все заявки» filtered
 * by form, dates and user with how many fields were filled, «По пользователям»
 * (a click shows that user's submissions), and a side panel with the answers,
 * files, «Открыть в очереди сервера» and «Удалить заявку».
 */
export default function ResponsesTab() {
    const {t, i18n} = useTranslation();
    const toast = useToast();
    const [view, setView] = useState<View>("all");
    const [formId, setFormId] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [query, setQuery] = useState("");
    const [user, setUser] = useState("");
    const [sort, setSort] = useState<SortState>({key: "createdAt", dir: "desc"});
    const [page, setPage] = useState(0);
    const [data, setData] = useState<{ key: string; rows: Row[]; users: UserRow[]; total: number; pages: number } | null>(null);
    const [error, setError] = useState<{ message: string; code?: string } | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [forms, setForms] = useState<{ id: string; title: string }[]>([]);
    const [open, setOpen] = useState<Row | null>(null);
    const [deleting, setDeleting] = useState<Row | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    // The user box applies once typing pauses.
    useEffect(() => {
        const id = setTimeout(() => {
            setUser(query.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(id);
    }, [query]);

    const params = new URLSearchParams({page: String(page), size: String(PAGE_SIZE)});
    if (user) params.set("user", user);
    if (view === "all") {
        params.set("sort", `createdAt,${sort.dir}`);
        if (formId) params.set("formId", formId);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
    }
    const path = view === "all" ? `/admin/submissions?${params}` : `/admin/submissions/by-user?${params}`;
    const key = `${path}|${reloadKey}`;

    useEffect(() => {
        let cancelled = false;
        apiRequest<Page<Row & UserRow>>(key.split("|")[0])
            .then(r => {
                if (cancelled) return;
                setData({key, rows: r.content, users: r.content, total: r.page.totalElements, pages: r.page.totalPages});
                setError(null);
            })
            .catch(e => !cancelled && setError({
                message: describeApiError(e, t("adminResponses.loadError")),
                code: e instanceof ApiError ? `HTTP ${e.status}` : undefined,
            }));
        return () => {
            cancelled = true;
        };
    }, [key, t]);

    useEffect(() => {
        apiRequest<Stats>("/admin/submissions/stats").then(setStats).catch(() => undefined);
    }, [reloadKey]);
    useEffect(() => {
        apiRequest<Page<{ form: { id: string; title: string } }>>("/admin/forms?size=100&sort=title,asc")
            .then(r => setForms(r.content.map(x => x.form))).catch(() => undefined);
    }, []);

    const loading = !error && data?.key !== key;
    const current = data?.key === key ? data : null;
    const filtered = formId !== "" || from !== "" || to !== "" || user !== "";
    const n = (v: number) => v.toLocaleString(i18n.language);
    const day = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, {day: "numeric", month: "short"});
    const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});

    const reset = () => {
        setFormId("");
        setFrom("");
        setTo("");
        setQuery("");
        setUser("");
        setPage(0);
    };
    const switchView = (v: View) => {
        setView(v);
        setPage(0);
        setOpen(null);
    };
    const showUser = (u: UserRow) => {
        setQuery(u.discordId);
        setUser(u.discordId);
        setView("all");
        setPage(0);
    };
    const remove = async (row: Row) => {
        try {
            await apiRequest(`/admin/submissions/${row.submission.id}`, {method: "DELETE"});
            toast({tone: "success", text: t("adminResponses.deleted")});
            if (open?.submission.id === row.submission.id) setOpen(null);
            setReloadKey(k => k + 1);
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminResponses.deleteError"))});
        }
    };

    const author = (r: Row) => r.submission.discordUsername ?? r.submission.discordId ?? t("adminResponses.anonymous");
    const input = "h-[38px] rounded-[10px] border border-bd bg-sf px-3 text-[13px] text-tx outline-none focus:border-pr";
    const empty = (
        <EmptyState title={t("ui.nothingFound")} text={filtered ? t("adminResponses.emptyFiltered") : t("adminResponses.empty")}
                    action={filtered ? (
                        <button type="button" className="font-semibold text-prt hover:underline" onClick={reset}>{t("ui.resetFilters")}</button>
                    ) : undefined}/>
    );

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em]">{t("adminResponses.title")}</h1>
                    <p className="m-0 text-sm text-mu">{t("adminResponses.subtitle")}</p>
                </div>
                <SegmentedControl ariaLabel={t("adminResponses.view")} value={view} onChange={switchView}
                                  options={[{value: "all", label: t("adminResponses.all")}, {value: "users", label: t("adminResponses.byUser")}]}/>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                <KpiCard label={t("adminResponses.kpi.total")} value={stats ? n(stats.total) : "—"}
                         extra={stats ? t("adminResponses.kpi.lastWeek", {count: stats.lastWeek, value: n(stats.lastWeek)}) : undefined}/>
                <KpiCard label={t("adminResponses.kpi.forms")} value={stats ? `${n(stats.forms)} · ${n(stats.activeForms)}` : "—"}
                         extra={stats && stats.forms ? t("adminResponses.kpi.perForm", {value: n(Math.round(stats.total / stats.forms))}) : undefined}/>
                <KpiCard label={t("adminResponses.kpi.users")} value={stats ? n(stats.users) : "—"}
                         extra={stats && stats.users ? t("adminResponses.kpi.perUser", {value: (stats.total / stats.users).toLocaleString(i18n.language, {maximumFractionDigits: 1})}) : undefined}/>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
                {view === "all" && (
                    <>
                        <FilterSelect label={t("adminResponses.form")} value={formId} strong={formId !== ""}
                                      onChange={v => {
                                          setFormId(v);
                                          setPage(0);
                                      }}>
                            <option value="">{t("adminResponses.allForms")}</option>
                            {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                        </FilterSelect>
                        <span className="flex items-center gap-1.5">
                            <input type="date" value={from} max={to || undefined} aria-label={t("adminResponses.from")} className={input}
                                   onChange={e => {
                                       setFrom(e.target.value);
                                       setPage(0);
                                   }}/>
                            <span className="text-mu" aria-hidden="true">—</span>
                            <input type="date" value={to} min={from || undefined} aria-label={t("adminResponses.to")} className={input}
                                   onChange={e => {
                                       setTo(e.target.value);
                                       setPage(0);
                                   }}/>
                        </span>
                    </>
                )}
                <label className="flex h-[38px] flex-[1_1_220px] items-center gap-2 rounded-[10px] border border-bd bg-sf px-3 text-mu focus-within:border-pr">
                    <FiSearch size={15} aria-hidden="true"/>
                    <input value={query} onChange={e => setQuery(e.target.value)} aria-label={t("adminResponses.user")}
                           placeholder={t("adminResponses.userPlaceholder")}
                           className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-tx outline-none placeholder:text-mu"/>
                </label>
                {filtered && (
                    <button type="button" onClick={reset} className="h-[38px] rounded-[10px] px-3 text-[13px] font-semibold text-prt hover:bg-prs">
                        {t("adminResponses.reset")}
                    </button>
                )}
            </div>

            <div className="flex flex-wrap items-start gap-5">
                <section className="flex min-w-0 flex-[999_1_640px] flex-col">
                    {view === "all" ? (
                        <DataTable<Row>
                            caption={t("adminResponses.all")}
                            rows={current?.rows ?? []}
                            rowKey={r => r.submission.id}
                            loading={loading}
                            skeletonRows={8}
                            error={error}
                            onRetry={() => setReloadKey(k => k + 1)}
                            minWidth={760}
                            sort={sort}
                            onSortChange={s => {
                                setSort(s);
                                setPage(0);
                            }}
                            onRowClick={setOpen}
                            empty={empty}
                            columns={[
                                {key: "user", header: t("adminResponses.col.user"), render: r => (
                                    <span className={cx("flex min-w-0 items-center gap-2.5", open?.submission.id === r.submission.id && "text-prt")}>
                                        <Avatar name={author(r)} src={r.avatarUrl} size={30}/>
                                        <span className="flex min-w-0 flex-col gap-px">
                                            <span className="truncate font-semibold">{author(r)}</span>
                                            {r.submission.discordId && <span className="font-mono text-[11px] text-mu">{r.submission.discordId}</span>}
                                        </span>
                                    </span>
                                )},
                                {key: "form", header: t("adminResponses.col.form"), render: r => (
                                    <span className="flex min-w-0 flex-col gap-px">
                                        <span className="truncate">{r.submission.formTitle ?? "—"}</span>
                                        <span className="truncate text-xs text-mu">{r.guildName ?? r.guildId ?? "—"}</span>
                                    </span>
                                )},
                                {key: "createdAt", header: t("adminResponses.col.date"), sortable: true, width: "130px",
                                    render: r => <span className="whitespace-nowrap text-mu">{when(r.submission.createdAt)}</span>},
                                {key: "answered", header: t("adminResponses.col.answered"), width: "90px", align: "right", render: r => (
                                    <span className={cx("tabular-nums", r.answered < r.fields ? "text-mu" : "font-semibold")}>{r.answered}/{r.fields}</span>
                                )},
                                {key: "status", header: t("adminResponses.col.status"), width: "160px",
                                    render: r => <SubmissionStatusBadge status={r.submission.status}/>},
                            ]}
                            rowActions={r => (
                                <>
                                    <button type="button" onClick={() => setOpen(r)} aria-label={t("common.view")}
                                            title={t("common.view")}
                                            className="grid h-[30px] w-[30px] place-items-center rounded-lg text-mu hover:bg-s2 hover:text-tx">
                                        <FiEye size={15} aria-hidden="true"/>
                                    </button>
                                    <button type="button" onClick={() => setDeleting(r)} aria-label={t("common.delete")} title={t("common.delete")}
                                            className="grid h-[30px] w-[30px] place-items-center rounded-lg text-rdt hover:bg-rdb">
                                        <FiTrash2 size={15} aria-hidden="true"/>
                                    </button>
                                </>
                            )}
                            pagination={{page, pageCount: current?.pages ?? 0, total: current?.total ?? 0, onPageChange: setPage}}
                        />
                    ) : (
                        <DataTable<UserRow>
                            caption={t("adminResponses.byUser")}
                            rows={current?.users ?? []}
                            rowKey={u => u.discordId}
                            loading={loading}
                            skeletonRows={8}
                            error={error}
                            onRetry={() => setReloadKey(k => k + 1)}
                            minWidth={640}
                            onRowClick={showUser}
                            empty={empty}
                            columns={[
                                {key: "user", header: t("adminResponses.col.user"), render: u => (
                                    <span className="flex min-w-0 items-center gap-2.5">
                                        <Avatar name={u.username ?? u.discordId} src={u.avatarUrl} size={30}/>
                                        <span className="flex min-w-0 flex-col gap-px">
                                            <span className="truncate font-semibold">{u.username ?? u.discordId}</span>
                                            <span className="font-mono text-[11px] text-mu">{u.discordId}</span>
                                        </span>
                                    </span>
                                )},
                                {key: "submissions", header: t("adminResponses.col.submissions"), width: "110px", align: "right",
                                    render: u => <span className="font-semibold tabular-nums">{n(u.submissions)}</span>},
                                {key: "forms", header: t("adminResponses.col.forms"), width: "90px", align: "right",
                                    render: u => <span className="tabular-nums">{n(u.forms)}</span>},
                                {key: "last", header: t("adminResponses.col.last"), width: "120px",
                                    render: u => <span className="whitespace-nowrap text-mu">{day(u.last)}</span>},
                                {key: "go", header: "", width: "110px", align: "right", render: u => (
                                    <button type="button" onClick={e => {
                                        e.stopPropagation();
                                        showUser(u);
                                    }} className="inline-flex items-center gap-1 text-[13px] font-semibold text-prt hover:underline">
                                        {t("adminResponses.userSubmissions")}<FiArrowRight size={13} aria-hidden="true"/>
                                    </button>
                                )},
                            ]}
                            pagination={{page, pageCount: current?.pages ?? 0, total: current?.total ?? 0, onPageChange: setPage}}
                        />
                    )}
                </section>

                {view === "all" && open && (
                    <SubmissionPanel row={open} author={author(open)} when={when} onClose={() => setOpen(null)} onDelete={() => setDeleting(open)}/>
                )}
            </div>

            <ConfirmDialog open={deleting !== null} title={t("adminResponses.deleteTitle")}
                           text={deleting && t("adminResponses.deleteText", {user: author(deleting), form: deleting.submission.formTitle ?? "—"})}
                           confirmLabel={t("common.delete")}
                           onConfirm={async () => {
                               const row = deleting!;
                               setDeleting(null);
                               await remove(row);
                           }}
                           onCancel={() => setDeleting(null)}/>
        </div>
    );
}

/** The side panel: the status, every answer, the files and the actions (AdminResponses.dc.html). */
function SubmissionPanel({row, author, when, onClose, onDelete}: {
    row: Row;
    author: string;
    when: (iso: string) => string;
    onClose: () => void;
    onDelete: () => void;
}) {
    const {t} = useTranslation();
    const [detail, setDetail] = useState<{ id: string; value: SubmissionDetail } | null>(null);
    const [failed, setFailed] = useState<string | null>(null);
    const id = row.submission.id;

    useEffect(() => {
        let cancelled = false;
        getSubmissionDetail(id)
            .then(d => !cancelled && setDetail({id, value: d}))
            .catch(e => !cancelled && setFailed(describeApiError(e, t("adminResponses.loadError"))));
        return () => {
            cancelled = true;
        };
    }, [id, t]);

    const d = detail?.id === id ? detail.value : null;
    const files = d?.files ?? [];
    const queue = row.guildId ? `/dashboard/servers/${row.guildId}/submissions?submission=${id}` : null;

    return (
        <aside aria-label={t("adminResponses.panel")}
               className="flex min-w-0 flex-[1_1_380px] flex-col overflow-hidden rounded-[14px] border border-bd bg-sf">
            <div className="flex items-start gap-3 border-b border-bd p-[18px]">
                <Avatar name={author} src={row.avatarUrl} size={40}/>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold">{author}</span>
                    <span className="text-xs text-mu">
                        {[row.submission.formTitle, row.guildName, when(row.submission.createdAt)].filter(Boolean).join(" · ")}
                    </span>
                </div>
                <button type="button" onClick={onClose} aria-label={t("ui.close")}
                        className="grid h-8 w-8 flex-none place-items-center rounded-lg text-mu hover:bg-s2 hover:text-tx">
                    <FiX size={16} aria-hidden="true"/>
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-bd px-[18px] py-3 text-xs">
                <SubmissionStatusBadge status={d?.submission.status ?? row.submission.status}/>
                <span className="rounded-full bg-s2 px-2 py-[3px] font-semibold">{t("adminResponses.filled", {answered: row.answered, fields: row.fields})}</span>
                {row.submission.discordId && <span className="ml-auto font-mono text-mu">ID {row.submission.discordId}</span>}
            </div>
            <div className="flex max-h-[560px] flex-col gap-3.5 overflow-y-auto p-[18px]">
                {failed ? <p role="alert" className="m-0 text-sm text-rdt">{failed}</p>
                    : !d ? [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg"/>)
                        : d.schema.fields.filter(f => f.type !== "SECTION_BREAK" && f.type !== "FILE_UPLOAD").map(f => (
                            <div key={f.id} className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-mu">{f.label}</span>
                                <span className="whitespace-pre-wrap break-words text-sm leading-normal">{formatAnswer(f, d.submission.answers[f.id], t)}</span>
                            </div>
                        ))}
                {files.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-bd pt-3.5">
                        <span className="text-xs font-semibold text-mu">{t("adminResponses.files", {count: files.length})}</span>
                        <div className="flex flex-wrap gap-2">{files.map(f => <Attachment key={f.id} file={f}/>)}</div>
                    </div>
                )}
            </div>
            <div className="mt-auto flex flex-wrap gap-2 border-t border-bd p-[18px]">
                <button type="button" onClick={onDelete}
                        className="h-9 rounded-[10px] border border-bd px-3 text-[13px] font-semibold text-rdt hover:bg-rdb">
                    {t("adminResponses.delete")}
                </button>
                {queue && (
                    <Link to={queue} className="ml-auto inline-flex h-9 items-center rounded-[10px] bg-pr px-3 text-[13px] font-semibold text-white hover:bg-prh">
                        {t("adminResponses.openQueue")}
                    </Link>
                )}
            </div>
        </aside>
    );
}
