import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {FiAlertTriangle, FiCheck, FiCopy, FiDownload, FiExternalLink, FiPause, FiPlay, FiSearch, FiTrash2, FiX} from "react-icons/fi";
import {ApiError, apiRequest, downloadFile} from "../../api/client";
import {getGuildConnectUrl, publishGuildForm, setGuildFormStatus, type DashboardForm} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import {ConfirmDialog, cx, DataTable, EmptyState, KpiCard, SegmentedControl, ServerIcon, type SortState, useToast} from "../../ui";
import FilterSelect from "./moderation/FilterSelect";

// Docs: docs/design/mockups/AdminForms.dc.html, AdminFormsDelete, AdminFormsLoading, AdminFormsError, R1280Forms; ТЗ 6.0, 6.1.

interface Row {
    form: DashboardForm;
    guildName: string | null;
    guildIconUrl: string | null;
}

interface ServerRow {
    guildId: string;
    name: string;
    iconUrl: string | null;
    botStatus: "CONNECTED" | "KICKED";
    forms: number;
}

type Segment = "all" | "active" | "inactive";
const PAGE_SIZE = 25;

/**
 * Платформа · Формы (ТЗ 6.1, FORMS_MANAGE): every form on every server —
 * KPIs, Все / Активные / Неактивные, the server, search by title or slug,
 * a sortable paged table with bulk «Деактивировать» / «Удалить», a CSV of the
 * list, and the connected servers with «Подключить сервер».
 */
export default function FormsTab() {
    const {t, i18n} = useTranslation();
    const toast = useToast();
    const navigate = useNavigate();
    const [segment, setSegment] = useState<Segment>("all");
    const [server, setServer] = useState("");
    const [query, setQuery] = useState("");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<SortState>({key: "createdAt", dir: "desc"});
    const [page, setPage] = useState(0);
    const [data, setData] = useState<{ key: string; rows: Row[]; total: number; pages: number } | null>(null);
    const [error, setError] = useState<{ message: string; code?: string } | null>(null);
    const [stats, setStats] = useState<{ total: number; active: number; submissions: number } | null>(null);
    const [servers, setServers] = useState<ServerRow[] | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState<Row | null>(null);
    const [bulkDelete, setBulkDelete] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [connecting, setConnecting] = useState(false);
    const [banner, setBanner] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const connected = params.get("connectedGuild");
        const failed = params.get("guildConnectError");
        if (!connected && !failed) return null;
        window.history.replaceState(null, "", window.location.pathname);
        if (connected) return {tone: "ok", text: t("adminForms.connected", {guildId: connected})};
        return failed === "manager" ? {tone: "warn", text: t("adminForms.connectManager")} : {tone: "error", text: t("adminForms.connectBot")};
    });

    // The search box applies once typing pauses.
    useEffect(() => {
        const id = setTimeout(() => {
            setSearch(query.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(id);
    }, [query]);

    const params = new URLSearchParams({status: segment, sort: `${sort.key},${sort.dir}`, page: String(page), size: String(PAGE_SIZE)});
    if (server) params.set("serverId", server);
    if (search) params.set("q", search);
    const key = `${params}|${reloadKey}`;

    useEffect(() => {
        let cancelled = false;
        apiRequest<{ content: Row[]; page: { totalElements: number; totalPages: number } }>(`/admin/forms?${key.split("|")[0]}`)
            .then(r => {
                if (cancelled) return;
                setData({key, rows: r.content, total: r.page.totalElements, pages: r.page.totalPages});
                setError(null);
            })
            .catch(e => !cancelled && setError({
                message: describeApiError(e, t("adminForms.loadError")),
                code: e instanceof ApiError ? `HTTP ${e.status}` : undefined,
            }));
        return () => {
            cancelled = true;
        };
    }, [key, t]);

    useEffect(() => {
        apiRequest<{ total: number; active: number; submissions: number }>("/admin/forms/stats").then(setStats).catch(() => undefined);
        apiRequest<ServerRow[]>("/admin/forms/servers").then(setServers).catch(() => setServers([]));
    }, [reloadKey]);

    const reload = () => {
        setSelected(new Set());
        setReloadKey(k => k + 1);
    };
    const loading = !error && data?.key !== key;
    const rows = data?.key === key ? data.rows : [];
    const filtered = segment !== "all" || server !== "" || search !== "";
    const n = (v: number) => v.toLocaleString(i18n.language);

    const toggle = async (row: Row) => {
        const live = row.form.status === "PUBLISHED";
        try {
            if (live) await setGuildFormStatus(row.form.serverId!, row.form.id, "CLOSED");
            else await publishGuildForm(row.form.serverId!, row.form.id);
            toast({tone: "success", text: t(live ? "adminForms.deactivated" : "adminForms.activated", {title: row.form.title})});
            reload();
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminForms.actionError"))});
        }
    };
    const bulk = async (action: "DEACTIVATE" | "DELETE") => {
        try {
            const r = await apiRequest<{ done: number }>("/admin/forms/bulk", {method: "POST", body: {ids: [...selected], action}});
            toast({tone: "success", text: t(`adminForms.bulkDone.${action}`, {count: r.done})});
            reload();
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminForms.actionError"))});
        }
    };
    const remove = async (row: Row) => {
        try {
            await apiRequest(`/admin/forms/bulk`, {method: "POST", body: {ids: [row.form.id], action: "DELETE"}});
            toast({tone: "success", text: t("adminForms.deleted", {title: row.form.title})});
            reload();
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminForms.actionError"))});
        }
    };
    const copyLink = (slug: string) => navigator.clipboard.writeText(`${window.location.origin}/f/${slug}`)
        .then(() => toast({tone: "success", text: t("adminForms.copied"), action: {label: t("adminForms.openLink"), onClick: () => window.open(`/f/${slug}`, "_blank")}}))
        .catch(() => undefined);
    const exportCsv = () => {
        const p = new URLSearchParams({status: segment});
        if (server) p.set("serverId", server);
        if (search) p.set("q", search);
        downloadFile(`/admin/forms/export?${p}`, "forms.csv").catch(e => toast({tone: "error", text: describeApiError(e, t("adminForms.actionError"))}));
    };
    const connect = async () => {
        setConnecting(true);
        try {
            window.location.href = (await getGuildConnectUrl()).url;
        } catch (e) {
            setBanner({tone: "error", text: describeApiError(e, t("adminForms.connectError"))});
            setConnecting(false);
        }
    };

    const statusCls = (s?: string) => s === "PUBLISHED" ? "bg-gnb text-gnt" : s === "DRAFT" ? "bg-s2 text-mu" : s === "ARCHIVED" ? "bg-s2 text-mu" : "bg-amb text-amt";
    const iconBtn = "grid h-[30px] w-[30px] place-items-center rounded-lg text-mu hover:bg-s2 hover:text-tx";

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em]">{t("adminForms.title")}</h1>
                    <p className="m-0 text-sm text-mu">{t("adminForms.subtitle")}</p>
                </div>
                <button type="button" onClick={exportCsv}
                        className="flex h-[38px] items-center gap-2 rounded-[10px] border border-bd bg-sf px-3.5 text-sm font-medium text-tx hover:bg-s2">
                    <FiDownload size={15} aria-hidden="true"/>{t("adminForms.export")}
                </button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                <KpiCard label={t("adminForms.kpi.total")} value={stats ? n(stats.total) : "—"}/>
                <KpiCard label={t("adminForms.kpi.active")} value={stats ? n(stats.active) : "—"}
                         extra={stats && stats.total ? `· ${Math.round(stats.active / stats.total * 100)}%` : undefined}/>
                <KpiCard label={t("adminForms.kpi.submissions")} value={stats ? n(stats.submissions) : "—"}/>
            </div>

            <div className="flex flex-wrap items-start gap-5">
                <section className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <SegmentedControl ariaLabel={t("adminForms.filter")} value={segment}
                                          onChange={v => {
                                              setSegment(v);
                                              setPage(0);
                                          }}
                                          options={(["all", "active", "inactive"] as const).map(v => ({
                                              value: v, label: t(`adminForms.segment.${v}`),
                                              count: stats ? (v === "all" ? stats.total : v === "active" ? stats.active : stats.total - stats.active) : undefined,
                                          }))}/>
                        <FilterSelect label={t("adminForms.server")} value={server} strong={false}
                                      onChange={v => {
                                          setServer(v);
                                          setPage(0);
                                      }}>
                            <option value="">{t("adminForms.allServers")}</option>
                            {servers?.map(s => <option key={s.guildId} value={s.guildId}>{s.name}</option>)}
                        </FilterSelect>
                        <label className="flex h-[38px] flex-[1_1_220px] items-center gap-2 rounded-[10px] border border-bd bg-sf px-3 text-mu focus-within:border-pr">
                            <FiSearch size={15} aria-hidden="true"/>
                            <input value={query} onChange={e => setQuery(e.target.value)} aria-label={t("adminForms.search")}
                                   placeholder={t("adminForms.searchPlaceholder")}
                                   className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-tx outline-none placeholder:text-mu"/>
                        </label>
                    </div>

                    <DataTable<Row>
                        caption={t("adminForms.title")}
                        rows={rows}
                        rowKey={r => r.form.id}
                        loading={loading}
                        skeletonRows={6}
                        error={error}
                        onRetry={reload}
                        maxHeight={640}
                        minWidth={760}
                        sort={sort}
                        onSortChange={s => {
                            setSort(s);
                            setPage(0);
                        }}
                        selectable
                        selected={selected}
                        onSelectedChange={setSelected}
                        bulkActions={(
                            <>
                                <button type="button" onClick={() => bulk("DEACTIVATE")}
                                        className="h-[30px] rounded-lg border border-bd bg-sf px-2.5 text-[13px] text-tx hover:bg-s2">
                                    {t("adminForms.deactivate")}
                                </button>
                                <button type="button" onClick={() => setBulkDelete(true)}
                                        className="h-[30px] rounded-lg border border-bd bg-sf px-2.5 text-[13px] text-rdt hover:bg-rdb">
                                    {t("common.delete")}
                                </button>
                            </>
                        )}
                        empty={(
                            <EmptyState title={t("ui.nothingFound")} text={filtered ? t("adminForms.emptyFiltered") : t("adminForms.empty")}
                                        action={filtered ? (
                                            <button type="button" className="font-semibold text-prt hover:underline" onClick={() => {
                                                setSegment("all");
                                                setServer("");
                                                setQuery("");
                                            }}>{t("ui.resetFilters")}</button>
                                        ) : undefined}/>
                        )}
                        columns={[
                            {key: "title", header: t("adminForms.col.title"), sortable: true, render: r => (
                                <div className="flex min-w-0 flex-col gap-0.5">
                                    <span className="truncate font-semibold">{r.form.title}</span>
                                    <span className="font-mono text-[11px] text-mu">{r.form.slug ? `/f/${r.form.slug}` : "—"}</span>
                                </div>
                            )},
                            {key: "server", header: t("adminForms.col.server"), render: r => (
                                <span className="inline-flex min-w-0 items-center gap-2">
                                    <ServerIcon name={r.guildName} src={r.guildIconUrl} size={22}/>
                                    <span className="truncate">{r.guildName ?? r.form.serverId}</span>
                                </span>
                            )},
                            {key: "status", header: t("adminForms.col.status"), sortable: true, width: "140px", render: r => (
                                <span className={cx("inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-xs font-semibold", statusCls(r.form.status))}>
                                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"/>
                                    {t(`guildForms.status.${r.form.status ?? "DRAFT"}`)}
                                </span>
                            )},
                            {key: "submissions", header: t("adminForms.col.submissions"), sortable: true, width: "100px", align: "right",
                                render: r => <span className="font-semibold tabular-nums">{n(r.form.submissionCount)}</span>},
                            {key: "createdAt", header: t("adminForms.col.created"), sortable: true, width: "120px", render: r => (
                                <span className="whitespace-nowrap text-mu">{new Date(r.form.createdAt).toLocaleDateString(i18n.language, {day: "numeric", month: "short", year: "numeric"})}</span>
                            )},
                        ]}
                        rowActions={r => (
                            <>
                                <button type="button" onClick={() => navigate(`/dashboard/forms/${r.form.id}/edit`)} aria-label={t("adminForms.open")}
                                        title={t("adminForms.open")} className={iconBtn}><FiExternalLink size={15} aria-hidden="true"/></button>
                                {r.form.slug && (
                                    <button type="button" onClick={() => copyLink(r.form.slug!)} aria-label={t("adminForms.copyLink")}
                                            title={t("adminForms.copyLink")} className={iconBtn}><FiCopy size={15} aria-hidden="true"/></button>
                                )}
                                {r.form.status !== "ARCHIVED" && r.form.serverId && (
                                    <button type="button" onClick={() => toggle(r)}
                                            aria-label={t(r.form.status === "PUBLISHED" ? "adminForms.deactivate" : "adminForms.activate")}
                                            title={t(r.form.status === "PUBLISHED" ? "adminForms.deactivate" : "adminForms.activate")} className={iconBtn}>
                                        {r.form.status === "PUBLISHED" ? <FiPause size={15} aria-hidden="true"/> : <FiPlay size={15} aria-hidden="true"/>}
                                    </button>
                                )}
                                <button type="button" onClick={() => setDeleting(r)} aria-label={t("common.delete")} title={t("common.delete")}
                                        className={cx(iconBtn, "text-rdt hover:text-rdt")}><FiTrash2 size={15} aria-hidden="true"/></button>
                            </>
                        )}
                        pagination={{page, pageCount: data?.pages ?? 0, total: data?.total ?? 0, onPageChange: setPage}}
                    />
                </section>

                <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 rounded-[14px] border border-bd bg-sf p-[18px]">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="m-0 text-[15px] font-bold">{t("adminForms.servers", {count: servers?.length ?? 0})}</h2>
                        <button type="button" onClick={connect} disabled={connecting}
                                className="h-8 rounded-[9px] bg-pr px-2.5 text-[13px] font-semibold text-white hover:bg-prh disabled:opacity-60">
                            {t("adminForms.connect")}
                        </button>
                    </div>
                    {banner && (
                        <div role={banner.tone === "ok" ? "status" : "alert"}
                             className={cx("flex gap-2 rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.4]",
                                 banner.tone === "ok" ? "bg-gnb text-gnt" : banner.tone === "warn" ? "bg-amb text-amt" : "bg-rdb text-rdt")}>
                            {banner.tone === "ok" ? <FiCheck size={15} className="mt-px flex-none" aria-hidden="true"/>
                                : <FiAlertTriangle size={15} className="mt-px flex-none" aria-hidden="true"/>}
                            <span className="flex-1">{banner.text}</span>
                            <button type="button" onClick={() => setBanner(null)} aria-label={t("ui.close")}><FiX size={14} aria-hidden="true"/></button>
                        </div>
                    )}
                    <ul className="m-0 flex list-none flex-col p-0">
                        {servers?.map(s => (
                            <li key={s.guildId} className="flex items-center gap-2.5 border-t border-bd py-2.5">
                                <ServerIcon name={s.name} src={s.iconUrl} size={30}/>
                                <span className="flex min-w-0 flex-1 flex-col gap-px">
                                    <span className="truncate text-[13px] font-semibold">{s.name}</span>
                                    <span className="text-xs text-mu">{t("adminForms.formsCount", {count: s.forms})}</span>
                                </span>
                                <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    s.botStatus === "CONNECTED" ? "bg-gnb text-gnt" : "bg-rdb text-rdt")}>
                                    {t(`servers.botShort.${s.botStatus}`)}
                                </span>
                            </li>
                        ))}
                        {servers?.length === 0 && <li className="text-[13px] text-mu">{t("adminForms.noServers")}</li>}
                    </ul>
                </aside>
            </div>

            <ConfirmDialog open={deleting !== null} title={t("adminForms.deleteTitle", {title: deleting?.form.title ?? ""})}
                           text={deleting && t("adminForms.deleteText", {count: deleting.form.submissionCount})}
                           requireText={deleting?.form.slug ?? deleting?.form.id.slice(0, 8)}
                           requireLabel={t("adminForms.deleteType")}
                           confirmLabel={t("common.delete")}
                           onConfirm={async () => {
                               const row = deleting!;
                               setDeleting(null);
                               await remove(row);
                           }}
                           onCancel={() => setDeleting(null)}/>
            <ConfirmDialog open={bulkDelete} title={t("adminForms.bulkDeleteTitle", {count: selected.size})}
                           text={t("adminForms.bulkDeleteText")} confirmLabel={t("common.delete")}
                           onConfirm={async () => {
                               setBulkDelete(false);
                               await bulk("DELETE");
                           }}
                           onCancel={() => setBulkDelete(false)}/>
        </div>
    );
}
