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
                    <div key={fieldId} className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFB] p-3">
                        <p className="mb-1 text-xs font-medium text-[#6B6B76]">{getLabel(fieldId)}</p>
                        <p className="text-sm text-[#1E1E24] break-words">
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                        </p>
                    </div>
                ))}
            </div>
            <div className="mt-4 rounded-lg border border-[#E4E4E7] bg-[#FAFAFB] px-3 py-2">
                <span className="text-[11px] font-mono text-[#8B8B96]">ID: {submission.id}</span>
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
                    <h1 className="text-xl font-semibold text-[#1E1E24]">{t("responses.title")}</h1>
                    <p className="mt-0.5 text-sm text-[#6B6B76]">{t("responses.subtitle")}</p>
                </div>
                <div className="flex rounded-lg border border-[#E4E4E7] bg-white p-0.5">
                    {(["all", "by-user"] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                view === v
                                    ? "bg-[#F0F0F2] text-[#1E1E24]"
                                    : "text-[#8B8B96] hover:text-[#55555F]"
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
                    accentColor="#3730A3"
                />
                <StatsCard
                    label={t("responses.stats.forms")}
                    value={forms.length}
                    sub={t("responses.stats.activeForms", {count: forms.filter(f => f.active).length})}
                    icon={<FiFileText size={16}/>}
                    accentColor="#3F6B4A"
                />
                <StatsCard
                    label={t("responses.stats.uniqueUsers")}
                    value={userCounts.length}
                    sub={t("responses.stats.withAtLeastOne")}
                    icon={<FiUsers size={16}/>}
                    accentColor="#5B3E96"
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
                            className="rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-xs text-[#55555F] outline-none focus:border-[#3730A3]"
                        >
                            <option value="">{t("responses.filter.allForms")}</option>
                            {forms.map(f => (
                                <option key={f.id} value={f.id}>{f.title}</option>
                            ))}
                        </select>

                        <div
                            className="flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 py-2">
                            <FiSearch size={12} className="flex-shrink-0 text-[#8B8B96]"/>
                            <input
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && applySearch()}
                                placeholder={t("responses.filter.searchPlaceholder")}
                                className="w-36 bg-transparent text-xs text-[#1E1E24] placeholder-[#C7C7CE] outline-none"
                            />
                            {searchInput && (
                                <button onClick={clearSearch}
                                        className="text-[#8B8B96] hover:text-[#1E1E24] transition-colors">
                                    <FiX size={11}/>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={applySearch}
                            className="rounded-lg bg-[#3730A3] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2D2682]"
                        >
                            {t("common.search")}
                        </button>

                        <div className="ml-auto flex items-center gap-1.5">
                            <FiFilter size={11} className="text-[#8B8B96]"/>
                            {(["createdAt", "discordId"] as const).map(field => (
                                <button
                                    key={field}
                                    onClick={() => toggleSort(field)}
                                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                                        filters.sortBy === field
                                            ? "border-[#D8DCF5] bg-[#EEF0FB] text-[#3730A3]"
                                            : "border-[#E4E4E7] bg-white text-[#6B6B76] hover:text-[#1E1E24]"
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
                                    className="flex items-center gap-1.5 rounded-full border border-[#D8DCF5] bg-[#EEF0FB] px-2.5 py-1 text-xs text-[#3730A3]">
                                    <FiFileText size={10}/>
                                    {formName(filters.formId)}
                                    <button
                                        onClick={() => {
                                            setFilters(f => ({...f, formId: ""}));
                                            setPage(0);
                                        }}
                                        className="ml-0.5 transition-colors hover:text-[#2D2682]"
                                    >
                                        <FiX size={9}/>
                                    </button>
                                </span>
                            )}
                            {filters.search && (
                                <span
                                    className="flex items-center gap-1.5 rounded-full border border-[#E0D5F2] bg-[#F2EEFA] px-2.5 py-1 text-xs text-[#5B3E96]">
                                    <FiUser size={10}/>
                                    {filters.search}
                                    <button onClick={clearSearch} className="ml-0.5 transition-colors hover:text-[#3E2A6B]">
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
                        <div className="overflow-hidden rounded-xl border border-[#E4E4E7]">
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="border-b border-[#E4E4E7] bg-[#FAFAFB]">
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{t("responses.table.user")}</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{t("responses.table.form")}</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{t("responses.table.date")}</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{t("responses.table.fields")}</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{t("responses.table.actions")}</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F0F0F2]">
                                {submissions.map(sub => (
                                    <tr key={sub.id} className="group transition-colors hover:bg-[#FAFAFB]">
                                        <td className="px-5 py-4">
                                            <p className="text-sm text-[#1E1E24]">{username(sub.discordId)}</p>
                                            <p className="mt-0.5 font-mono text-[11px] text-[#8B8B96]">{sub.discordId}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="max-w-[160px] truncate text-sm text-[#55555F]">{formName(sub.formId)}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm text-[#55555F]">
                                                {new Date(sub.createdAt).toLocaleDateString("en-GB", {
                                                    day: "2-digit", month: "short", year: "numeric",
                                                })}
                                            </p>
                                            <p className="mt-0.5 text-xs text-[#8B8B96]">{new Date(sub.createdAt).toLocaleTimeString()}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                                <span
                                                    className="rounded-md border border-[#E4E4E7] bg-[#FAFAFB] px-2 py-0.5 text-xs text-[#6B6B76]">
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
                            <span className="text-xs text-[#8B8B96]">
                                {t("responses.pagination.info", {page: page + 1, total: totalPages, elements: totalElements})}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="flex items-center gap-1 rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-[#6B6B76] transition-colors hover:text-[#1E1E24] disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    <FiChevronLeft size={13}/> {t("responses.pagination.prev")}
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="flex items-center gap-1 rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-[#6B6B76] transition-colors hover:text-[#1E1E24] disabled:cursor-not-allowed disabled:opacity-30"
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
                    <p className="mb-4 text-xs text-[#8B8B96]">
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
                                    className="flex items-center gap-4 rounded-xl border border-[#E4E4E7] bg-white p-4 text-left transition-colors hover:border-[#D8DCF5] hover:bg-[#EEF0FB]"
                                >
                                    <div
                                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[#D8DCF5] bg-[#EEF0FB]">
                                        <FiUser size={16} className="text-[#3730A3]"/>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-[#1E1E24]">
                                            {username(discordId)}
                                        </p>
                                        <p className="mt-0.5 font-mono text-[11px] text-[#8B8B96]">{discordId}</p>
                                        <p className="mt-0.5 text-xs text-[#8B8B96]">
                                            {t("responses.responseCount", {count})}
                                        </p>
                                    </div>
                                    <FiChevronRight size={14} className="flex-shrink-0 text-[#C7C7CE]"/>
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
