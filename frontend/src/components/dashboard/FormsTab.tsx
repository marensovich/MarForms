import {useEffect, useState} from "react";
import {AnimatePresence} from "framer-motion";
import {useTranslation} from "react-i18next";
import {
    type DashboardForm,
    type DashboardSubmission,
    deleteForm,
    getDashboardForms,
    getForm,
    getFormSubmissions,
    getGuildConnectUrl,
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
    FiExternalLink,
    FiFileText,
    FiInbox,
    FiLink,
    FiList,
    FiToggleLeft,
    FiToggleRight,
    FiTrash2,
    FiX,
} from "react-icons/fi";

type StatusFilter = "all" | "active" | "inactive";

function CopyLinkButton({formId}: { formId: string }) {
    const {t} = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(`${window.location.origin}/forms/${formId}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <ActionBtn onClick={handleCopy} variant={copied ? "success" : "ghost"} title="Copy shareable link">
            {copied
                ? <><FiCheck size={11} className="inline mr-1"/>{t("forms.row.copied")}</>
                : <><FiLink size={11} className="inline mr-1"/>{t("forms.row.copyLink")}</>}
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

    const {t} = useTranslation();

    if (selected) {
        return (
            <Modal
                title={t("forms.responses.detailsTitle")}
                subtitle={`${t("forms.responses.fromUser", {id: selected.discordId})} · ${new Date(selected.createdAt).toLocaleString()}`}
                onClose={() => setSelected(null)}
                width="max-w-lg"
            >
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
                    {Object.entries(selected.answers).map(([fieldId, value]) => (
                        <div key={fieldId} className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFB] p-3">
                            <p className="mb-1 text-xs font-medium text-[#6B6B76]">{getLabel(fieldId)}</p>
                            <p className="text-sm text-[#1E1E24] break-words">
                                {Array.isArray(value) ? value.join(", ") : String(value)}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={() => setSelected(null)}
                        className="rounded-lg border border-[#E4E4E7] px-4 py-2 text-sm text-[#8B8B96] hover:text-[#1E1E24] transition-colors"
                    >
                        {t("forms.responses.backToList")}
                    </button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            title={t("forms.responses.modalTitle", {formTitle: form.title})}
            subtitle={form.submissionCount === 1
                ? t("forms.responses.totalOne", {count: form.submissionCount})
                : t("forms.responses.totalMany", {count: form.submissionCount})}
            onClose={onClose}
            width="max-w-xl"
        >
            {loading ? (
                <TabSkeleton rows={4}/>
            ) : submissions.length === 0 ? (
                <EmptyState message={t("forms.responses.noSubmissions")} icon={<FiInbox/>}/>
            ) : (
                <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
                    {submissions.map(sub => (
                        <button
                            key={sub.id}
                            onClick={() => setSelected(sub)}
                            className="flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-[#FAFAFB] px-4 py-3 text-left transition-colors hover:border-[#D4D4D9] hover:bg-[#F0F0F2]"
                        >
                            <div>
                                <p className="text-sm font-medium text-[#1E1E24] font-mono">{sub.discordId}</p>
                                <p className="mt-0.5 text-xs text-[#8B8B96]">
                                    {t("forms.responses.fieldsAnswered", {count: Object.keys(sub.answers).length})}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-[#8B8B96]">{new Date(sub.createdAt).toLocaleDateString()}</p>
                                <p className="text-xs text-[#8B8B96]">{new Date(sub.createdAt).toLocaleTimeString()}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </Modal>
    );
}


export default function FormsTab() {
    const {t} = useTranslation();
    const [forms, setForms] = useState<DashboardForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [showWizard, setShowWizard] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [responsesForm, setResponsesForm] = useState<DashboardForm | null>(null);
    const [editForm, setEditForm] = useState<DashboardForm | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DashboardForm | null>(null);
    const [connectBanner, setConnectBanner] = useState<{ type: "success" | "error"; guildId?: string } | null>(null);
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const connectedGuild = params.get("connectedGuild");
        const connectError = params.get("guildConnectError");
        if (connectedGuild) {
            setConnectBanner({type: "success", guildId: connectedGuild});
        } else if (connectError) {
            setConnectBanner({type: "error"});
        }
        if (connectedGuild || connectError) {
            params.delete("connectedGuild");
            params.delete("guildConnectError");
            const query = params.toString();
            window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
        }
    }, []);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const {url} = await getGuildConnectUrl();
            window.location.href = url;
        } finally {
            setConnecting(false);
        }
    };

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
                    <h1 className="text-xl font-semibold text-[#1E1E24]">{t("forms.title")}</h1>
                    <p className="mt-0.5 text-sm text-[#6B6B76]">
                        {t("forms.subtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="flex items-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-4 py-2 text-sm font-medium text-[#55555F] transition-colors hover:border-[#D4D4D9] hover:text-[#1E1E24] disabled:opacity-50"
                    >
                        <FiExternalLink size={14}/>
                        {t("forms.connectServer")}
                    </button>
                    <button
                        onClick={() => setShowWizard(true)}
                        className="flex items-center gap-2 rounded-lg bg-[#3730A3] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2D2682]"
                    >
                        <FiFileText size={14}/>
                        {t("forms.newForm")}
                    </button>
                </div>
            </div>

            {/* Connect result banner */}
            {connectBanner && (
                <div className={`mb-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                    connectBanner.type === "success"
                        ? "border-[#D7E8D9] bg-[#EEF4EE] text-[#3F6B4A]"
                        : "border-[#EAD4D3] bg-[#F7EEEE] text-[#8B4A46]"
                }`}>
                    <span>
                        {connectBanner.type === "success"
                            ? t("forms.connectSuccess", {guildId: connectBanner.guildId})
                            : t("forms.connectError")}
                    </span>
                    <button onClick={() => setConnectBanner(null)} className="flex-shrink-0 opacity-70 hover:opacity-100">
                        <FiX size={14}/>
                    </button>
                </div>
            )}

            {/* Stats */}
            {!loading && (
                <div className="mb-6 grid grid-cols-3 gap-4">
                    <StatsCard
                        label={t("forms.stats.totalForms")}
                        value={forms.length}
                        sub={t("forms.stats.activeForms", {count: activeForms})}
                        icon={<FiFileText size={16}/>}
                        accentColor="#3730A3"
                    />
                    <StatsCard
                        label={t("forms.stats.active")}
                        value={activeForms}
                        sub={forms.length > 0 ? t("forms.stats.ofTotal", {pct: Math.round((activeForms / forms.length) * 100)}) : "—"}
                        icon={<FiCheckCircle size={16}/>}
                        accentColor="#3F6B4A"
                    />
                    <StatsCard
                        label={t("forms.stats.totalResponses")}
                        value={totalSubmissions}
                        sub={t("forms.stats.acrossAllForms")}
                        icon={<FiInbox size={16}/>}
                        accentColor="#5B3E96"
                    />
                </div>
            )}

            {/* Filters */}
            <div className="mb-4 flex items-center gap-2">
                {(["all", "active", "inactive"] as StatusFilter[]).map(f => (
                    <button
                        key={f}
                        onClick={() => setStatusFilter(f)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            statusFilter === f
                                ? "bg-[#F0F0F2] text-[#1E1E24]"
                                : "text-[#8B8B96] hover:text-[#55555F]"
                        }`}
                    >
                        {t(`forms.filter.${f}`)}
                        {f !== "all" && (
                            <span className="ml-1.5 text-[#8B8B96]">
                                {f === "active" ? activeForms : forms.length - activeForms}
                            </span>
                        )}
                    </button>
                ))}
                <span className="ml-auto text-xs text-[#8B8B96]">{t("forms.filter.shown", {count: filtered.length})}</span>
            </div>

            {/* Table */}
            {loading ? (
                <TabSkeleton/>
            ) : filtered.length === 0 ? (
                <EmptyState
                    message={statusFilter === "all"
                        ? t("forms.empty.noForms")
                        : t("forms.empty.noFiltered", {status: t(`forms.filter.${statusFilter}`)})}
                    icon={<FiFileText/>}
                />
            ) : (
                <div className="overflow-hidden rounded-xl border border-[#E4E4E7]">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-[#E4E4E7] bg-[#FAFAFB]">
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{t("forms.table.title")}</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{t("forms.table.status")}</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{t("forms.table.responses")}</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{t("forms.table.created")}</th>
                            <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{t("forms.table.actions")}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0F0F2]">
                        {filtered.map(form => (
                            <tr
                                key={form.id}
                                className="group transition-colors hover:bg-[#FAFAFB]"
                            >
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border ${
                                                form.active
                                                    ? "border-[#D7E8D9] bg-[#EEF4EE] text-[#3F6B4A]"
                                                    : "border-[#E4E4E7] bg-[#F0F0F2] text-[#8B8B96]"
                                            }`}>
                                            <FiFileText size={13}/>
                                        </div>
                                        <div>
                                            <p className="font-medium text-[#1E1E24]">{form.title}</p>
                                            <p className="mt-0.5 text-xs text-[#8B8B96] font-mono">{form.id.slice(0, 8)}…</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <Badge color={form.active ? "green" : "default"} dot>
                                        {form.active ? t("forms.row.active") : t("forms.row.inactive")}
                                    </Badge>
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-[#1E1E24]">{form.submissionCount}</span>
                                        <button
                                            onClick={() => setResponsesForm(form)}
                                            className="flex items-center gap-1 rounded text-xs text-[#8B8B96] transition-colors hover:text-[#3730A3]"
                                            title="View responses"
                                        >
                                            <FiList size={11}/>
                                            {t("common.view")}
                                        </button>
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-sm text-[#6B6B76]">
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
                                            {t("common.edit")}
                                        </ActionBtn>
                                        <CopyLinkButton formId={form.id}/>
                                        <ActionBtn
                                            onClick={() => handleToggle(form)}
                                            variant="primary"
                                            title={form.active ? t("forms.row.deactivate") : t("forms.row.activate")}
                                        >
                                            {form.active
                                                ? <><FiToggleLeft size={11} className="inline mr-1"/>{t("forms.row.deactivate")}</>
                                                : <><FiToggleRight size={11} className="inline mr-1"/>{t("forms.row.activate")}</>}
                                        </ActionBtn>
                                        <ActionBtn
                                            onClick={() => setDeleteTarget(form)}
                                            variant="danger"
                                            title="Delete form"
                                        >
                                            <FiTrash2 size={11} className="inline mr-1"/>
                                            {t("common.delete")}
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
                        title={t("forms.deleteConfirm.title")}
                        message={t("forms.deleteConfirm.message", {title: deleteTarget.title, count: deleteTarget.submissionCount})}
                        confirmLabel={t("forms.deleteConfirm.confirm")}
                        confirmColor="red"
                        onConfirm={handleDelete}
                        onCancel={() => setDeleteTarget(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
