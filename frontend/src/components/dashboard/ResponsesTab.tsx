import {useEffect, useState} from "react";
import {useAuth} from "../../hooks/useAuth";
import {useTranslation} from "react-i18next";
import {
    type DashboardForm,
    type DashboardSubmission,
    deleteSubmission,
    getAllSubmissions,
    getDashboardForms,
    getForm,
    getUsers,
    getUserSubmissionCounts,
    type UserSubmissionCount,
} from "../../api/dashboard";
import {type FormDefinition} from "../../types/forms";
import {ActionBtn, ConfirmModal, EmptyState, Modal, StatsCard, TabSkeleton} from "./shared";
import {
    FiArrowDown,
    FiArrowUp,
    FiChevronLeft,
    FiChevronRight,
    FiEye,
    FiFileText,
    FiFilter,
    FiInbox,
    FiSearch,
    FiTrash2,
    FiUser,
    FiUsers,
    FiX,
} from "react-icons/fi";

type SortDir = "ASC" | "DESC";
type View = "all" | "by-user";

interface Filters {
    formId: string;
    search: string;
    sortBy: "createdAt" | "discordId";
    sortDir: SortDir;
}

const PAGE_SIZE = 15;

function SubmissionDetailModal({
                                   submission,
                                   formDef,
                                   onClose,
                               }: {
    submission: DashboardSubmission;
    formDef: FormDefinition | null;
    onClose: () => void;
}) {
    const getLabel = (fieldId: string): string => {
        const field = formDef?.schema.fields.find(f => f.id === fieldId);
        return field?.label ?? fieldId;
    };

    const {t} = useTranslation();
    return (
        <Modal
            title={t("responses.submissionDetails")}
            subtitle={`${submission.discordId} · ${new Date(submission.createdAt).toLocaleString()}`}
            onClose={onClose}
            width="max-w-lg"
        >
            <div className="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {Object.entries(submission.answers).map(([fieldId, value]) => (
                    <div key={fieldId} className="rounded-lg border border-bd bg-bg p-3">
                        <p className="mb-1 text-xs font-medium text-mu">{getLabel(fieldId)}</p>
                        <p className="text-sm text-tx break-words">
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                        </p>
                    </div>
                ))}
            </div>
            <div className="mt-4 rounded-lg border border-bd bg-bg px-3 py-2">
                <span className="text-[11px] font-mono text-mu">ID: {submission.id}</span>
            </div>
        </Modal>
    );
}

export default function ResponsesTab() {
    const {t} = useTranslation();
    const {user} = useAuth();
    const canManage = user?.permissions.includes("RESPONSES_MANAGE") ?? false;

    const [view, setView] = useState<View>("all");
    const [forms, setForms] = useState<DashboardForm[]>([]);
    const [submissions, setSubmissions] = useState<DashboardSubmission[]>([]);
    const [userCounts, setUserCounts] = useState<UserSubmissionCount[]>([]);
    const [usernameMap, setUsernameMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [filters, setFilters] = useState<Filters>({
        formId: "",
        search: "",
        sortBy: "createdAt",
        sortDir: "DESC",
    });
    const [searchInput, setSearchInput] = useState("");
    const [selected, setSelected] = useState<DashboardSubmission | null>(null);
    const [formDef, setFormDef] = useState<FormDefinition | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DashboardSubmission | null>(null);

    // Load static data on mount
    useEffect(() => {
        Promise.all([
            getDashboardForms(0, 100),
            getUserSubmissionCounts().catch(() => []),
            getUsers(0, 1000).catch(() => null),
        ]).then(([formsPage, counts, usersPage]) => {
            setForms(formsPage.content);
            setUserCounts(counts);
            if (usersPage) {
                const map = new Map<string, string>();
                usersPage.content.forEach(u => map.set(String(u.discordId), u.discordUsername));
                setUsernameMap(map);
            }
        });
    }, []);

    // Load submissions when in "all" view
    useEffect(() => {
        if (view !== "all") return;
        let cancelled = false;
        setLoading(true);
        getAllSubmissions({
            formId: filters.formId || undefined,
            search: filters.search || undefined,
            page,
            size: PAGE_SIZE,
            sortBy: filters.sortBy,
            sortDir: filters.sortDir,
        }).then(r => {
            if (cancelled) return;
            setSubmissions(r.content);
            setTotalPages(r.page.totalPages);
            setTotalElements(r.page.totalElements);
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [view, page, filters]);

    // Load user counts when switching to by-user view
    useEffect(() => {
        if (view !== "by-user") return;
        setLoading(true);
        getUserSubmissionCounts()
            .then(setUserCounts)
            .finally(() => setLoading(false));
    }, [view]);

    // Load form definition for detail modal
    useEffect(() => {
        if (!selected) {
            setFormDef(null);
            return;
        }
        getForm(selected.formId).then(setFormDef).catch(() => setFormDef(null));
    }, [selected]);

    const applySearch = () => {
        setFilters(f => ({...f, search: searchInput.trim()}));
        setPage(0);
    };

    const clearSearch = () => {
        setSearchInput("");
        setFilters(f => ({...f, search: ""}));
        setPage(0);
    };

    const toggleSort = (field: "createdAt" | "discordId") => {
        setFilters(f => ({
            ...f,
            sortBy: field,
            sortDir: f.sortBy === field ? (f.sortDir === "DESC" ? "ASC" : "DESC") : "DESC",
        }));
        setPage(0);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteSubmission(deleteTarget.id);
        setDeleteTarget(null);
        setFilters(f => ({...f})); // retrigger load
    };

    const drillToUser = (discordId: string) => {
        setView("all");
        setSearchInput(discordId);
        setFilters(f => ({...f, search: discordId}));
        setPage(0);
    };

    const formName = (formId: string) =>
        forms.find(f => f.id === formId)?.title ?? formId.slice(0, 8) + "…";

    const username = (discordId: string) => usernameMap.get(discordId) ?? discordId;

    function SortArrow({field}: { field: "createdAt" | "discordId" }) {
        if (filters.sortBy !== field) return null;
        return filters.sortDir === "DESC" ? <FiArrowDown size={10}/> : <FiArrowUp size={10}/>;
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-tx">{t("responses.title")}</h1>
                    <p className="mt-0.5 text-sm text-mu">{t("responses.subtitle")}</p>
                </div>
                <div className="flex rounded-lg border border-bd bg-sf p-0.5">
                    {(["all", "by-user"] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                view === v
                                    ? "bg-s2 text-tx"
                                    : "text-mu hover:text-mu"
                            }`}
                        >
                            {v === "all" ? <FiInbox size={12}/> : <FiUsers size={12}/>}
                            {v === "all" ? t("responses.allResponses") : t("responses.byUser")}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats row (always visible) */}
            <div className="mb-5 grid grid-cols-3 gap-4">
                <StatsCard
                    label={t("responses.stats.totalResponses")}
                    value={totalElements}
                    sub={filters.formId
                        ? t("responses.stats.inForm", {formName: formName(filters.formId)})
                        : t("responses.stats.acrossAllForms")}
                    icon={<FiInbox size={16}/>}
                    accentColor="rgb(var(--prt))"
                />
                <StatsCard
                    label={t("responses.stats.forms")}
                    value={forms.length}
                    sub={t("responses.stats.activeForms", {count: forms.filter(f => f.active).length})}
                    icon={<FiFileText size={16}/>}
                    accentColor="rgb(var(--gnt))"
                />
                <StatsCard
                    label={t("responses.stats.uniqueUsers")}
                    value={userCounts.length}
                    sub={t("responses.stats.withAtLeastOne")}
                    icon={<FiUsers size={16}/>}
                    accentColor="rgb(var(--prt))"
                />
            </div>

            {view === "all" ? (
                <>
                    {/* Filter bar */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <select
                            value={filters.formId}
                            onChange={e => {
                                setFilters(f => ({...f, formId: e.target.value}));
                                setPage(0);
                            }}
                            className="rounded-lg border border-bd bg-sf px-3 py-2 text-xs text-mu outline-none focus:border-pr"
                        >
                            <option value="">{t("responses.filter.allForms")}</option>
                            {forms.map(f => (
                                <option key={f.id} value={f.id}>{f.title}</option>
                            ))}
                        </select>

                        <div
                            className="flex items-center gap-1.5 rounded-lg border border-bd bg-sf px-3 py-2">
                            <FiSearch size={12} className="flex-shrink-0 text-mu"/>
                            <input
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && applySearch()}
                                placeholder={t("responses.filter.searchPlaceholder")}
                                className="w-36 bg-transparent text-xs text-tx placeholder-mu/70 outline-none"
                            />
                            {searchInput && (
                                <button onClick={clearSearch}
                                        className="text-mu hover:text-tx transition-colors">
                                    <FiX size={11}/>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={applySearch}
                            className="rounded-lg bg-pr px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-prh"
                        >
                            {t("common.search")}
                        </button>

                        <div className="ml-auto flex items-center gap-1.5">
                            <FiFilter size={11} className="text-mu"/>
                            {(["createdAt", "discordId"] as const).map(field => (
                                <button
                                    key={field}
                                    onClick={() => toggleSort(field)}
                                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                                        filters.sortBy === field
                                            ? "border-prs bg-prs text-prt"
                                            : "border-bd bg-sf text-mu hover:text-tx"
                                    }`}
                                >
                                    {field === "createdAt" ? t("responses.filter.date") : t("responses.filter.user")}
                                    <SortArrow field={field}/>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Active filter chips */}
                    {(filters.formId || filters.search) && (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            {filters.formId && (
                                <span
                                    className="flex items-center gap-1.5 rounded-full border border-prs bg-prs px-2.5 py-1 text-xs text-prt">
                                    <FiFileText size={10}/>
                                    {formName(filters.formId)}
                                    <button
                                        onClick={() => {
                                            setFilters(f => ({...f, formId: ""}));
                                            setPage(0);
                                        }}
                                        className="ml-0.5 transition-colors hover:text-prt"
                                    >
                                        <FiX size={9}/>
                                    </button>
                                </span>
                            )}
                            {filters.search && (
                                <span
                                    className="flex items-center gap-1.5 rounded-full border border-prs bg-prs px-2.5 py-1 text-xs text-prt">
                                    <FiUser size={10}/>
                                    {filters.search}
                                    <button onClick={clearSearch} className="ml-0.5 transition-colors hover:text-prt">
                                        <FiX size={9}/>
                                    </button>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Table */}
                    {loading ? (
                        <TabSkeleton/>
                    ) : submissions.length === 0 ? (
                        <EmptyState message={t("responses.noResponses")} icon={<FiInbox/>}/>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-bd">
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="border-b border-bd bg-bg">
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-mu">{t("responses.table.user")}</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-mu">{t("responses.table.form")}</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-mu">{t("responses.table.date")}</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-mu">{t("responses.table.fields")}</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-mu">{t("responses.table.actions")}</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-bd">
                                {submissions.map(sub => (
                                    <tr key={sub.id} className="group transition-colors hover:bg-bg">
                                        <td className="px-5 py-4">
                                            <p className="text-sm text-tx">{username(sub.discordId)}</p>
                                            <p className="mt-0.5 font-mono text-[11px] text-mu">{sub.discordId}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="max-w-[160px] truncate text-sm text-mu">{formName(sub.formId)}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm text-mu">
                                                {new Date(sub.createdAt).toLocaleDateString("en-GB", {
                                                    day: "2-digit", month: "short", year: "numeric",
                                                })}
                                            </p>
                                            <p className="mt-0.5 text-xs text-mu">{new Date(sub.createdAt).toLocaleTimeString()}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                                <span
                                                    className="rounded-md border border-bd bg-bg px-2 py-0.5 text-xs text-mu">
                                                    {t("responses.table.fieldsCount", {count: Object.keys(sub.answers).length})}
                                                </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <ActionBtn onClick={() => setSelected(sub)} variant="ghost">
                                                    <FiEye size={11} className="mr-1 inline"/> {t("common.view")}
                                                </ActionBtn>
                                                {canManage && (
                                                    <ActionBtn onClick={() => setDeleteTarget(sub)} variant="danger">
                                                        <FiTrash2 size={11}/>
                                                    </ActionBtn>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-4 flex items-center justify-between">
                            <span className="text-xs text-mu">
                                {t("responses.pagination.info", {page: page + 1, total: totalPages, elements: totalElements})}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="flex items-center gap-1 rounded-lg border border-bd px-3 py-1.5 text-xs text-mu transition-colors hover:text-tx disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    <FiChevronLeft size={13}/> {t("responses.pagination.prev")}
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="flex items-center gap-1 rounded-lg border border-bd px-3 py-1.5 text-xs text-mu transition-colors hover:text-tx disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    {t("responses.pagination.next")} <FiChevronRight size={13}/>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* By User view */
                <>
                    <p className="mb-4 text-xs text-mu">
                        {t("responses.byUserHint")}
                    </p>
                    {loading ? (
                        <TabSkeleton/>
                    ) : userCounts.length === 0 ? (
                        <EmptyState message={t("responses.noSubmissions")} icon={<FiUsers/>}/>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {userCounts.map(({discordId, count}) => (
                                <button
                                    key={discordId}
                                    onClick={() => drillToUser(discordId)}
                                    className="flex items-center gap-4 rounded-xl border border-bd bg-sf p-4 text-left transition-colors hover:border-prs hover:bg-prs"
                                >
                                    <div
                                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-prs bg-prs">
                                        <FiUser size={16} className="text-prt"/>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-tx">
                                            {username(discordId)}
                                        </p>
                                        <p className="mt-0.5 font-mono text-[11px] text-mu">{discordId}</p>
                                        <p className="mt-0.5 text-xs text-mu">
                                            {t("responses.responseCount", {count})}
                                        </p>
                                    </div>
                                    <FiChevronRight size={14} className="flex-shrink-0 text-mu/70"/>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {selected && (
                <SubmissionDetailModal
                    submission={selected}
                    formDef={formDef}
                    onClose={() => setSelected(null)}
                />
            )}
            {deleteTarget && (
                <ConfirmModal
                    title={t("responses.deleteConfirm.title")}
                    message={t("responses.deleteConfirm.message", {username: username(deleteTarget.discordId)})}
                    confirmLabel={t("responses.deleteConfirm.confirm")}
                    confirmColor="red"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
}
