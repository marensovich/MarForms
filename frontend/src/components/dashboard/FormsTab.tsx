import {useEffect, useState} from "react";
import {AnimatePresence} from "framer-motion";
import {useTranslation} from "react-i18next";
import {
    type DashboardForm,
    type DashboardSubmission,
    type MyGuild,
    deleteForm,
    getDashboardForms,
    getForm,
    getFormSubmissions,
    getGuildConnectUrl,
    getMyGuilds,
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
    FiServer,
    FiToggleLeft,
    FiToggleRight,
    FiTrash2,
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
                        <div key={fieldId} className="rounded-lg border border-bd bg-bg p-3">
                            <p className="mb-1 text-xs font-medium text-mu">{getLabel(fieldId)}</p>
                            <p className="text-sm text-tx break-words">
                                {Array.isArray(value) ? value.join(", ") : String(value)}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={() => setSelected(null)}
                        className="rounded-lg border border-bd px-4 py-2 text-sm text-mu hover:text-tx transition-colors"
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
                            className="flex items-center justify-between rounded-lg border border-bd bg-bg px-4 py-3 text-left transition-colors hover:border-bd hover:bg-s2"
                        >
                            <div>
                                <p className="text-sm font-medium text-tx font-mono">{sub.discordId}</p>
                                <p className="mt-0.5 text-xs text-mu">
                                    {t("forms.responses.fieldsAnswered", {count: Object.keys(sub.answers).length})}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-mu">{new Date(sub.createdAt).toLocaleDateString()}</p>
                                <p className="text-xs text-mu">{new Date(sub.createdAt).toLocaleTimeString()}</p>
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
    const [connecting, setConnecting] = useState(false);
    const [guilds, setGuilds] = useState<MyGuild[]>([]);
    const [guildsLoading, setGuildsLoading] = useState(true);

    const loadGuilds = async () => {
        setGuildsLoading(true);
        try {
            setGuilds(await getMyGuilds());
        } finally {
            setGuildsLoading(false);
        }
    };

    useEffect(() => {
        loadGuilds();
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
                    <h1 className="text-xl font-semibold text-tx">{t("forms.title")}</h1>
                    <p className="mt-0.5 text-sm text-mu">
                        {t("forms.subtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="flex items-center gap-2 rounded-lg border border-bd bg-sf px-4 py-2 text-sm font-medium text-mu transition-colors hover:border-bd hover:text-tx disabled:opacity-50"
                    >
                        <FiExternalLink size={14}/>
                        {t("forms.connectServer")}
                    </button>
                    <button
                        onClick={() => setShowWizard(true)}
                        className="flex items-center gap-2 rounded-lg bg-pr px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-prh"
                    >
                        <FiFileText size={14}/>
                        {t("forms.newForm")}
                    </button>
                </div>
            </div>

            {/* Connect result banner */}
            {/* Connected servers */}
            {!guildsLoading && guilds.length > 0 && (
                <div className="mb-6">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-mu">
                        {t("forms.guilds.title")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {guilds.map(g => (
                            <div
                                key={g.guildId}
                                className="flex items-center gap-2 rounded-lg border border-bd bg-sf px-3 py-2 text-sm"
                            >
                                <FiServer size={13} className="text-mu"/>
                                <span className="font-medium text-tx">{g.guildName}</span>
                                <Badge color={g.botStatus === "CONNECTED" ? "green" : "red"} dot>
                                    {g.botStatus === "CONNECTED" ? t("forms.guilds.connected") : t("forms.guilds.kicked")}
                                </Badge>
                                <span className="text-xs text-mu">{t(`forms.guilds.role.${g.role.toLowerCase()}`)}</span>
                            </div>
                        ))}
                    </div>
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
                        accentColor="rgb(var(--prt))"
                    />
                    <StatsCard
                        label={t("forms.stats.active")}
                        value={activeForms}
                        sub={forms.length > 0 ? t("forms.stats.ofTotal", {pct: Math.round((activeForms / forms.length) * 100)}) : "—"}
                        icon={<FiCheckCircle size={16}/>}
                        accentColor="rgb(var(--gnt))"
                    />
                    <StatsCard
                        label={t("forms.stats.totalResponses")}
                        value={totalSubmissions}
                        sub={t("forms.stats.acrossAllForms")}
                        icon={<FiInbox size={16}/>}
                        accentColor="rgb(var(--prt))"
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
                                ? "bg-s2 text-tx"
                                : "text-mu hover:text-mu"
                        }`}
                    >
                        {t(`forms.filter.${f}`)}
                        {f !== "all" && (
                            <span className="ml-1.5 text-mu">
                                {f === "active" ? activeForms : forms.length - activeForms}
                            </span>
                        )}
                    </button>
                ))}
                <span className="ml-auto text-xs text-mu">{t("forms.filter.shown", {count: filtered.length})}</span>
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
                <div className="overflow-hidden rounded-xl border border-bd">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-bd bg-bg">
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-mu">{t("forms.table.title")}</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-mu">{t("forms.table.status")}</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-mu">{t("forms.table.responses")}</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-mu">{t("forms.table.created")}</th>
                            <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-mu">{t("forms.table.actions")}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-bd">
                        {filtered.map(form => (
                            <tr
                                key={form.id}
                                className="group transition-colors hover:bg-bg"
                            >
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border ${
                                                form.active
                                                    ? "border-gnb bg-gnb text-gnt"
                                                    : "border-bd bg-s2 text-mu"
                                            }`}>
                                            <FiFileText size={13}/>
                                        </div>
                                        <div>
                                            <p className="font-medium text-tx">{form.title}</p>
                                            <p className="mt-0.5 text-xs text-mu font-mono">{form.id.slice(0, 8)}…</p>
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
                                        <span className="font-medium text-tx">{form.submissionCount}</span>
                                        <button
                                            onClick={() => setResponsesForm(form)}
                                            className="flex items-center gap-1 rounded text-xs text-mu transition-colors hover:text-prt"
                                            title="View responses"
                                        >
                                            <FiList size={11}/>
                                            {t("common.view")}
                                        </button>
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-sm text-mu">
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
