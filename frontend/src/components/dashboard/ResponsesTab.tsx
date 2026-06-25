import {useEffect, useState} from "react";
import {useAuth} from "../../hooks/useAuth";
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

    return (
        <Modal
            title="Submission Details"
            subtitle={`${submission.discordId} · ${new Date(submission.createdAt).toLocaleString()}`}
            onClose={onClose}
            width="max-w-lg"
        >
            <div className="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {Object.entries(submission.answers).map(([fieldId, value]) => (
                    <div key={fieldId} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                        <p className="mb-1 text-xs font-medium text-white/60">{getLabel(fieldId)}</p>
                        <p className="text-sm text-white break-words">
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                        </p>
                    </div>
                ))}
            </div>
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <span className="text-[11px] font-mono text-white/35">ID: {submission.id}</span>
            </div>
        </Modal>
    );
}

export default function ResponsesTab() {
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
                    <h1 className="text-xl font-semibold text-white">Responses</h1>
                    <p className="mt-0.5 text-sm text-white/65">View and manage all form submissions</p>
                </div>
                <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
                    {(["all", "by-user"] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                view === v
                                    ? "bg-white/[0.08] text-white"
                                    : "text-white/45 hover:text-white/70"
                            }`}
                        >
                            {v === "all" ? <FiInbox size={12}/> : <FiUsers size={12}/>}
                            {v === "all" ? "All Responses" : "By User"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats row (always visible) */}
            <div className="mb-5 grid grid-cols-3 gap-4">
                <StatsCard
                    label="Total Responses"
                    value={totalElements}
                    sub={filters.formId ? `in "${formName(filters.formId)}"` : "across all forms"}
                    icon={<FiInbox size={16}/>}
                    accentColor="#6366f1"
                />
                <StatsCard
                    label="Forms"
                    value={forms.length}
                    sub={`${forms.filter(f => f.active).length} active`}
                    icon={<FiFileText size={16}/>}
                    accentColor="#34d399"
                />
                <StatsCard
                    label="Unique Users"
                    value={userCounts.length}
                    sub="with at least one response"
                    icon={<FiUsers size={16}/>}
                    accentColor="#a78bfa"
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
                            className="rounded-lg border border-white/[0.08] bg-[#0d0d1e] px-3 py-2 text-xs text-white/80 outline-none focus:border-indigo-500/50"
                        >
                            <option value="">All forms</option>
                            {forms.map(f => (
                                <option key={f.id} value={f.id}>{f.title}</option>
                            ))}
                        </select>

                        <div
                            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                            <FiSearch size={12} className="flex-shrink-0 text-white/40"/>
                            <input
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && applySearch()}
                                placeholder="Username or Discord ID…"
                                className="w-36 bg-transparent text-xs text-white placeholder-white/30 outline-none"
                            />
                            {searchInput && (
                                <button onClick={clearSearch}
                                        className="text-white/35 hover:text-white transition-colors">
                                    <FiX size={11}/>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={applySearch}
                            className="rounded-lg bg-indigo-600/80 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                        >
                            Search
                        </button>

                        <div className="ml-auto flex items-center gap-1.5">
                            <FiFilter size={11} className="text-white/30"/>
                            {(["createdAt", "discordId"] as const).map(field => (
                                <button
                                    key={field}
                                    onClick={() => toggleSort(field)}
                                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                                        filters.sortBy === field
                                            ? "border-indigo-500/30 bg-indigo-500/15 text-indigo-300"
                                            : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:text-white"
                                    }`}
                                >
                                    {field === "createdAt" ? "Date" : "User"}
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
                                    className="flex items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-300">
                                    <FiFileText size={10}/>
                                    {formName(filters.formId)}
                                    <button
                                        onClick={() => {
                                            setFilters(f => ({...f, formId: ""}));
                                            setPage(0);
                                        }}
                                        className="ml-0.5 transition-colors hover:text-white"
                                    >
                                        <FiX size={9}/>
                                    </button>
                                </span>
                            )}
                            {filters.search && (
                                <span
                                    className="flex items-center gap-1.5 rounded-full border border-purple-500/25 bg-purple-500/10 px-2.5 py-1 text-xs text-purple-300">
                                    <FiUser size={10}/>
                                    {filters.search}
                                    <button onClick={clearSearch} className="ml-0.5 transition-colors hover:text-white">
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
                        <EmptyState message="No responses found." icon={<FiInbox/>}/>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-white/[0.07]">
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">User</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">Form</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">Date</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">Fields</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/55">Actions</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                {submissions.map(sub => (
                                    <tr key={sub.id} className="group transition-colors hover:bg-white/[0.015]">
                                        <td className="px-5 py-4">
                                            <p className="text-sm text-white">{username(sub.discordId)}</p>
                                            <p className="mt-0.5 font-mono text-[11px] text-white/35">{sub.discordId}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="max-w-[160px] truncate text-sm text-white/75">{formName(sub.formId)}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm text-white/70">
                                                {new Date(sub.createdAt).toLocaleDateString("en-GB", {
                                                    day: "2-digit", month: "short", year: "numeric",
                                                })}
                                            </p>
                                            <p className="mt-0.5 text-xs text-white/40">{new Date(sub.createdAt).toLocaleTimeString()}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                                <span
                                                    className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-xs text-white/55">
                                                    {Object.keys(sub.answers).length} fields
                                                </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <ActionBtn onClick={() => setSelected(sub)} variant="ghost">
                                                    <FiEye size={11} className="mr-1 inline"/> View
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
                            <span className="text-xs text-white/40">
                                Page {page + 1} of {totalPages} · {totalElements} total
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-white/60 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    <FiChevronLeft size={13}/> Prev
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-white/60 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    Next <FiChevronRight size={13}/>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* By User view */
                <>
                    <p className="mb-4 text-xs text-white/45">
                        All users who have submitted at least one response. Click to view their submissions.
                    </p>
                    {loading ? (
                        <TabSkeleton/>
                    ) : userCounts.length === 0 ? (
                        <EmptyState message="No submissions yet." icon={<FiUsers/>}/>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {userCounts.map(({discordId, count}) => (
                                <button
                                    key={discordId}
                                    onClick={() => drillToUser(discordId)}
                                    className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition-colors hover:border-indigo-500/20 hover:bg-indigo-500/[0.04]"
                                >
                                    <div
                                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10">
                                        <FiUser size={16} className="text-indigo-400"/>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">
                                            {username(discordId)}
                                        </p>
                                        <p className="mt-0.5 font-mono text-[11px] text-white/35">{discordId}</p>
                                        <p className="mt-0.5 text-xs text-white/50">
                                            {count} response{count !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                    <FiChevronRight size={14} className="flex-shrink-0 text-white/30"/>
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
                    title="Delete submission"
                    message={`Delete
                    this submission from
                    ${username(deleteTarget.discordId)}
                    ?
                    This
                    cannot
                    be
                    undone
                    .`}
                    confirmLabel="Delete"
                    confirmColor="red"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
}
