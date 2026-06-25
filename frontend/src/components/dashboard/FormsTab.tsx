import {useEffect, useState} from "react";
import {AnimatePresence} from "framer-motion";
import {
    type DashboardForm,
    type DashboardSubmission,
    deleteForm,
    getDashboardForms,
    getForm,
    getFormSubmissions,
    toggleFormActive,
} from "../../api/dashboard";
import {type FormDefinition} from "../../types/forms";
import {ActionBtn, Badge, ConfirmModal, EmptyState, Modal, StatsCard, TabSkeleton} from "./shared";
import FormWizard from "./forms/FormWizard";
import FormEditModal from "./forms/FormEditModal";
import {
    FiCheck,
    FiCheckCircle,
    FiEdit3,
    FiFileText,
    FiInbox,
    FiLink,
    FiList,
    FiToggleLeft,
    FiToggleRight,
    FiTrash2,
} from "react-icons/fi";

type StatusFilter = "all" | "active" | "inactive";

function CopyLinkButton({formId}: { formId: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(`${window.location.origin}/forms/${formId}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <ActionBtn onClick={handleCopy} variant={copied ? "success" : "ghost"} title="Copy shareable link">
            {copied ? <><FiCheck size={11} className="inline mr-1"/>Copied</> : <><FiLink size={11}
                                                                                          className="inline mr-1"/>Copy
                link</>}
        </ActionBtn>
    );
}

function ResponsesModal({
                            form,
                            onClose,
                        }: {
    form: DashboardForm;
    onClose: () => void;
}) {
    const [submissions, setSubmissions] = useState<DashboardSubmission[]>([]);
    const [definition, setDefinition] = useState<FormDefinition | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<DashboardSubmission | null>(null);

    useEffect(() => {
        Promise.all([
            getFormSubmissions(form.id, 0, 50),
            getForm(form.id).catch(() => null),
        ]).then(([page, def]) => {
            setSubmissions(page.content);
            setDefinition(def);
        }).finally(() => setLoading(false));
    }, [form.id]);

    const getLabel = (fieldId: string): string => {
        const field = definition?.schema.fields.find(f => f.id === fieldId);
        return field?.label ?? fieldId;
    };

    if (selected) {
        return (
            <Modal
                title="Submission Details"
                subtitle={`From ${selected.discordId} · ${new Date(selected.createdAt).toLocaleString()}`}
                onClose={() => setSelected(null)}
                width="max-w-lg"
            >
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
                    {Object.entries(selected.answers).map(([fieldId, value]) => (
                        <div key={fieldId} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                            <p className="mb-1 text-xs font-medium text-white/65">{getLabel(fieldId)}</p>
                            <p className="text-sm text-white break-words">
                                {Array.isArray(value) ? value.join(", ") : String(value)}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={() => setSelected(null)}
                        className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
                    >
                        Back to list
                    </button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            title={`Responses — ${form.title}`}
            subtitle={`${form.submissionCount} total submission${form.submissionCount !== 1 ? "s" : ""}`}
            onClose={onClose}
            width="max-w-xl"
        >
            {loading ? (
                <TabSkeleton rows={4}/>
            ) : submissions.length === 0 ? (
                <EmptyState message="No submissions yet." icon={<FiInbox/>}/>
            ) : (
                <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
                    {submissions.map(sub => (
                        <button
                            key={sub.id}
                            onClick={() => setSelected(sub)}
                            className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
                        >
                            <div>
                                <p className="text-sm font-medium text-white font-mono">{sub.discordId}</p>
                                <p className="mt-0.5 text-xs text-white/35">
                                    {Object.keys(sub.answers).length} fields answered
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-white/35">{new Date(sub.createdAt).toLocaleDateString()}</p>
                                <p className="text-xs text-white/45">{new Date(sub.createdAt).toLocaleTimeString()}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </Modal>
    );
}


export default function FormsTab() {
    const [forms, setForms] = useState<DashboardForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [showWizard, setShowWizard] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [responsesForm, setResponsesForm] = useState<DashboardForm | null>(null);
    const [editForm, setEditForm] = useState<DashboardForm | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DashboardForm | null>(null);

    const loadForms = async () => {
        setLoading(true);
        try {
            const data = await getDashboardForms();
            setForms(data.content);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadForms();
    }, []);

    const handleToggle = async (form: DashboardForm) => {
        await toggleFormActive(form.id, !form.active);
        await loadForms();
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteForm(deleteTarget.id);
        setDeleteTarget(null);
        await loadForms();
    };

    const filtered = forms.filter(f => {
        if (statusFilter === "active") return f.active;
        if (statusFilter === "inactive") return !f.active;
        return true;
    });

    const totalSubmissions = forms.reduce((s, f) => s + f.submissionCount, 0);
    const activeForms = forms.filter(f => f.active).length;

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">Forms</h1>
                    <p className="mt-0.5 text-sm text-white/65">
                        Manage and publish your Discord forms
                    </p>
                </div>
                <button
                    onClick={() => setShowWizard(true)}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500"
                >
                    <FiFileText size={14}/>
                    New form
                </button>
            </div>

            {/* Stats */}
            {!loading && (
                <div className="mb-6 grid grid-cols-3 gap-4">
                    <StatsCard
                        label="Total Forms"
                        value={forms.length}
                        sub={`${activeForms} active`}
                        icon={<FiFileText size={16}/>}
                        accentColor="#6366f1"
                    />
                    <StatsCard
                        label="Active"
                        value={activeForms}
                        sub={forms.length > 0 ? `${Math.round((activeForms / forms.length) * 100)}% of total` : "—"}
                        icon={<FiCheckCircle size={16}/>}
                        accentColor="#34d399"
                    />
                    <StatsCard
                        label="Total Responses"
                        value={totalSubmissions}
                        sub="across all forms"
                        icon={<FiInbox size={16}/>}
                        accentColor="#a78bfa"
                    />
                </div>
            )}

            {/* Filters */}
            <div className="mb-4 flex items-center gap-2">
                {(["all", "active", "inactive"] as StatusFilter[]).map(f => (
                    <button
                        key={f}
                        onClick={() => setStatusFilter(f)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                            statusFilter === f
                                ? "bg-white/[0.08] text-white"
                                : "text-white/35 hover:text-white/60"
                        }`}
                    >
                        {f}
                        {f !== "all" && (
                            <span className="ml-1.5 text-white/45">
                                {f === "active" ? activeForms : forms.length - activeForms}
                            </span>
                        )}
                    </button>
                ))}
                <span className="ml-auto text-xs text-white/45">{filtered.length} shown</span>
            </div>

            {/* Table */}
            {loading ? (
                <TabSkeleton/>
            ) : filtered.length === 0 ? (
                <EmptyState
                    message={statusFilter === "all" ? "No forms yet. Create your first form." : `No ${statusFilter} forms.`}
                    icon={<FiFileText/>}
                />
            ) : (
                <div className="overflow-hidden rounded-xl border border-white/[0.07]">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">Title</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">Status</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">Responses</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">Created</th>
                            <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/55">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                        {filtered.map(form => (
                            <tr
                                key={form.id}
                                className="group transition-colors hover:bg-white/[0.015]"
                            >
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border ${
                                                form.active
                                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                                    : "border-white/[0.07] bg-white/[0.03] text-white/45"
                                            }`}>
                                            <FiFileText size={13}/>
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{form.title}</p>
                                            <p className="mt-0.5 text-xs text-white/50 font-mono">{form.id.slice(0, 8)}…</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <Badge color={form.active ? "green" : "default"} dot>
                                        {form.active ? "Active" : "Inactive"}
                                    </Badge>
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-white">{form.submissionCount}</span>
                                        <button
                                            onClick={() => setResponsesForm(form)}
                                            className="flex items-center gap-1 rounded text-xs text-white/50 transition-colors hover:text-indigo-400"
                                            title="View responses"
                                        >
                                            <FiList size={11}/>
                                            View
                                        </button>
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-sm text-white/65">
                                    {new Date(form.createdAt).toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center justify-end gap-1">
                                        <ActionBtn
                                            onClick={() => setEditForm(form)}
                                            variant="ghost"
                                            title="Edit form (coming soon)"
                                        >
                                            <FiEdit3 size={11} className="inline mr-1"/>
                                            Edit
                                        </ActionBtn>
                                        <CopyLinkButton formId={form.id}/>
                                        <ActionBtn
                                            onClick={() => handleToggle(form)}
                                            variant="primary"
                                            title={form.active ? "Deactivate form" : "Activate form"}
                                        >
                                            {form.active
                                                ? <><FiToggleLeft size={11} className="inline mr-1"/>Deactivate</>
                                                : <><FiToggleRight size={11} className="inline mr-1"/>Activate</>}
                                        </ActionBtn>
                                        <ActionBtn
                                            onClick={() => setDeleteTarget(form)}
                                            variant="danger"
                                            title="Delete form"
                                        >
                                            <FiTrash2 size={11} className="inline mr-1"/>
                                            Delete
                                        </ActionBtn>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AnimatePresence>
                {showWizard && (
                    <FormWizard
                        onClose={() => setShowWizard(false)}
                        onCreated={() => {
                            setShowWizard(false);
                            loadForms();
                        }}
                    />
                )}
                {responsesForm && (
                    <ResponsesModal form={responsesForm} onClose={() => setResponsesForm(null)}/>
                )}
                {editForm && (
                    <FormEditModal
                        form={editForm}
                        onClose={() => setEditForm(null)}
                        onUpdated={() => {
                            setEditForm(null);
                            loadForms();
                        }}
                    />
                )}
                {deleteTarget && (
                    <ConfirmModal
                        title="Delete form"
                        message={`Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone and will remove all ${deleteTarget.submissionCount} response${deleteTarget.submissionCount !== 1 ? "s" : ""}.`}
                        confirmLabel="Delete form"
                        confirmColor="red"
                        onConfirm={handleDelete}
                        onCancel={() => setDeleteTarget(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
