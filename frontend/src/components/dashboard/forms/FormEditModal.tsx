import {useEffect, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {
    FiAlertCircle,
    FiCheckCircle,
    FiEdit3,
    FiEye,
    FiFileText,
    FiLink,
    FiList,
    FiLoader,
    FiLock,
    FiSave,
    FiX,
} from "react-icons/fi";
import type {DashboardForm, UpdateFormPayload} from "../../../api/dashboard";
import {getForm, updateForm} from "../../../api/dashboard";
import {describeApiError} from "../../../api/errors";
import type {FormAccessMode, FormDefinition, FormField, WebhookConfig} from "../../../types/forms";
import StepWebhooks from "./StepWebhooks";
import StepFields from "./StepFields";
import AccessModeSelector from "./AccessModeSelector";
import RoleGateEditor from "./RoleGateEditor";
import FormPreviewModal from "./FormPreviewModal";

interface Props {
    form: DashboardForm;
    onClose: () => void;
    onUpdated: () => void;
    /** Opens on this tab, e.g. "webhooks" from «Проверить вебхуки». */
    initialTab?: Tab;
}

type Tab = "basic" | "fields" | "access" | "webhooks";

interface AccessSettings {
    accessMode: FormAccessMode;
    limit: string;
    opensAt: string;
    closesAt: string;
    allowedRoleIds: string[];
    deniedRoleIds: string[];
}

function inputCls(error?: boolean) {
    return `w-full rounded-xl border px-4 py-2.5 text-sm text-tx placeholder-mu/70 outline-none transition-colors focus:ring-1 ${
        error
            ? "border-rdb bg-rdb focus:border-rdt focus:ring-rdt/20"
            : "border-bd bg-bg focus:border-pr focus:ring-pr/20"
    }`;
}

/** Backend LocalDateTime ("2026-10-08T12:00:00") → <input type="datetime-local"> value. */
const toLocalInput = (value?: string | null) => (value ? value.slice(0, 16) : "");

function accessOf(def: FormDefinition): AccessSettings {
    return {
        accessMode: def.accessMode ?? "AUTHENTICATED",
        limit: def.submissionLimitPerUser ? String(def.submissionLimitPerUser) : "",
        opensAt: toLocalInput(def.opensAt),
        closesAt: toLocalInput(def.closesAt),
        allowedRoleIds: def.allowedRoleIds ?? [],
        deniedRoleIds: def.deniedRoleIds ?? [],
    };
}

export default function FormEditModal({form, onClose, onUpdated, initialTab = "basic"}: Props) {
    const {t} = useTranslation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>(initialTab);
    const [definition, setDefinition] = useState<FormDefinition | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    // Kept as loaded: the full-screen editor (#137) gets the input for it.
    const [reviewTime, setReviewTime] = useState<string | null>(null);
    const [fields, setFields] = useState<FormField[]>([]);
    const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
    const [access, setAccess] = useState<AccessSettings | null>(null);

    useEffect(() => {
        getForm(form.id)
            .then(def => {
                setDefinition(def);
                // A published form is edited in its draft (ТЗ ФТ-5.6.2).
                const schema = def.draftSchema ?? def.schema;
                setTitle(schema.title);
                setDescription(schema.description ?? "");
                setReviewTime(schema.reviewTime ?? null);
                setFields(schema.fields ?? []);
                setWebhooks(def.webhooks ?? []);
                setAccess(accessOf(def));
            })
            .catch(() => setError(t("formEdit.loadError")))
            .finally(() => setLoading(false));
    }, [form.id, t]);

    const accessChanged = definition !== null && access !== null
        && JSON.stringify(access) !== JSON.stringify(accessOf(definition));

    const handleSave = async () => {
        if (!definition || !access) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            // One request: fields, webhooks and access settings succeed or fail together,
            // and a form changed elsewhere since it was opened is refused (409), not overwritten.
            const payload: UpdateFormPayload = {
                schema: {title: title.trim(), description, reviewTime, fields},
                webhooks: webhooks.filter(w => w.url.trim()),
                version: definition.version,
                ...(accessChanged ? {
                    settings: {
                        accessMode: access.accessMode,
                        submissionLimitPerUser: access.limit ? Number(access.limit) : null,
                        opensAt: access.opensAt || null,
                        closesAt: access.closesAt || null,
                        allowedRoleIds: access.allowedRoleIds,
                        deniedRoleIds: access.deniedRoleIds,
                    },
                } : {}),
            };
            const updated = await updateForm(form.id, payload);
            setDefinition(updated);
            setAccess(accessOf(updated));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            onUpdated();
        } catch (e) {
            setError(describeApiError(e, t("formEdit.saveError")));
        } finally {
            setSaving(false);
        }
    };

    const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
        {id: "basic", label: t("formEdit.tabs.basicInfo"), icon: <FiFileText size={13}/>},
        {id: "fields", label: t("formEdit.tabs.fields"), icon: <FiList size={13}/>, count: fields.length},
        {id: "access", label: t("formEdit.tabs.access"), icon: <FiLock size={13}/>},
        {
            id: "webhooks",
            label: t("formEdit.tabs.webhooks"),
            icon: <FiLink size={13}/>,
            count: webhooks.filter(w => w.url.trim()).length
        },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
                initial={{opacity: 0, scale: 0.96, y: 8}}
                animate={{opacity: 1, scale: 1, y: 0}}
                exit={{opacity: 0, scale: 0.96, y: 8}}
                transition={{duration: 0.18}}
                className={`flex w-full flex-col rounded-2xl border border-bd bg-sf shadow-xl transition-all duration-200 ${
                    tab === "fields" ? "max-w-[960px]" : "max-w-[580px]"
                }`}
                style={{maxHeight: "calc(100vh - 2rem)"}}
            >
                {/* Header */}
                <div className="flex-shrink-0 border-b border-bd px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-prs bg-prs">
                                <FiEdit3 size={14} className="text-prt"/>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-tx">{t("formEdit.title")}</p>
                                <p className="text-xs text-mu font-mono">{form.id.slice(0, 8)}…</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-mu transition-colors hover:bg-s2 hover:text-tx"
                        >
                            <FiX size={14}/>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="mt-4 flex gap-1">
                        {tabs.map(tabItem => (
                            <button
                                key={tabItem.id}
                                onClick={() => setTab(tabItem.id)}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                    tab === tabItem.id
                                        ? "bg-s2 text-tx"
                                        : "text-mu hover:text-mu"
                                }`}
                            >
                                {tabItem.icon}
                                {tabItem.label}
                                {tabItem.count !== undefined && tabItem.count > 0 && (
                                    <span
                                        className="rounded-full bg-prs px-1.5 py-0.5 text-[10px] text-prt">
                                        {tabItem.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className={`flex-1 min-h-0 overflow-y-auto ${tab === "fields" ? "" : "p-6"}`}>
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <FiLoader size={20} className="animate-spin text-mu"/>
                        </div>
                    ) : error && !definition ? (
                        <div
                            className="m-6 flex items-center gap-2 rounded-xl border border-rdb bg-rdb px-4 py-3 text-sm text-rdt">
                            <FiAlertCircle size={14}/>{error}
                        </div>
                    ) : (
                        <>
                            {tab === "basic" && (
                                <div className="flex flex-col gap-4">
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-mu">{t("formEdit.formTitle")}</span>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder={t("formEdit.titlePlaceholder")}
                                            className={inputCls(!title.trim())}
                                        />
                                        {!title.trim() && (
                                            <p className="flex items-center gap-1 text-[11px] text-rdt">
                                                <FiAlertCircle size={10}/> {t("formEdit.titleRequired")}
                                            </p>
                                        )}
                                    </label>

                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-mu">{t("formEdit.description")}</span>
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder={t("formEdit.descPlaceholder")}
                                            rows={4}
                                            className={`${inputCls()} resize-none`}
                                        />
                                    </label>
                                </div>
                            )}

                            {tab === "fields" && (
                                <StepFields
                                    draft={{
                                        title,
                                        description,
                                        reviewTime: reviewTime ?? "",
                                        fields,
                                        serverId: definition ? String(definition.serverId) : "",
                                        channelsIds: [],
                                        webhooks,
                                        accessMode: access?.accessMode ?? "AUTHENTICATED",
                                        allowedRoleIds: [],
                                        deniedRoleIds: [],
                                    }}
                                    onChange={patch => {
                                        if (patch.fields !== undefined) setFields(patch.fields);
                                    }}
                                />
                            )}

                            {tab === "access" && access && (
                                <div className="flex flex-col gap-5">
                                    <div>
                                        <p className="mb-2 text-xs font-medium text-mu">{t("access.title")}</p>
                                        <AccessModeSelector
                                            value={access.accessMode}
                                            onChange={accessMode => setAccess({...access, accessMode})}
                                        />
                                        {access.accessMode === "ROLE_GATED" && definition && (
                                            <RoleGateEditor guildId={String(definition.serverId)}
                                                            value={{allowedRoleIds: access.allowedRoleIds, deniedRoleIds: access.deniedRoleIds}}
                                                            onChange={roles => setAccess({...access, ...roles})}/>
                                        )}
                                    </div>
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-mu">{t("access.limit")}</span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={access.limit}
                                            onChange={e => setAccess({...access, limit: e.target.value})}
                                            placeholder={t("access.limitPlaceholder")}
                                            className={inputCls()}
                                        />
                                    </label>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-mu">{t("access.opensAt")}</span>
                                            <input
                                                type="datetime-local"
                                                value={access.opensAt}
                                                onChange={e => setAccess({...access, opensAt: e.target.value})}
                                                className={inputCls()}
                                            />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-mu">{t("access.closesAt")}</span>
                                            <input
                                                type="datetime-local"
                                                value={access.closesAt}
                                                onChange={e => setAccess({...access, closesAt: e.target.value})}
                                                className={inputCls()}
                                            />
                                        </label>
                                    </div>
                                    <p className="text-[11px] text-mu">{t("access.scheduleHint")}</p>
                                </div>
                            )}

                            {tab === "webhooks" && (
                                <StepWebhooks
                                    draft={{
                                        title,
                                        description,
                                        reviewTime: reviewTime ?? "",
                                        fields,
                                        serverId: definition ? String(definition.serverId) : "",
                                        channelsIds: [],
                                        webhooks,
                                        accessMode: access?.accessMode ?? "AUTHENTICATED",
                                        allowedRoleIds: [],
                                        deniedRoleIds: [],
                                    }}
                                    onChange={patch => {
                                        if (patch.webhooks !== undefined) setWebhooks(patch.webhooks);
                                    }}
                                />
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex items-center justify-between border-t border-bd px-6 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-bd px-4 py-2 text-sm text-mu transition-colors hover:border-bd hover:text-tx"
                    >
                        {t("common.cancel")}
                    </button>

                    <div className="flex items-center gap-3">
                        {error && definition && (
                            <div className="flex max-w-xs items-center gap-1.5 text-xs text-rdt">
                                <FiAlertCircle size={12} className="flex-shrink-0"/>{error}
                            </div>
                        )}
                        {saved && (
                            <div className="flex items-center gap-1.5 text-xs text-gnt">
                                <FiCheckCircle size={12}/>{t("formEdit.saved")}
                            </div>
                        )}
                        {fields.length > 0 && (
                            <button
                                onClick={() => setPreviewOpen(true)}
                                className="flex items-center gap-1.5 rounded-xl border border-bd px-3 py-2 text-sm text-mu transition-colors hover:border-bd hover:text-tx"
                            >
                                <FiEye size={13}/>
                                {t("preview.open")}
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving || loading || !title.trim()}
                            className="flex items-center gap-2 rounded-xl bg-pr px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-prh disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {saving
                                ? <><FiLoader size={13} className="animate-spin"/>{t("formEdit.saving")}</>
                                : <><FiSave size={13}/>{t("formEdit.save")}</>
                            }
                        </button>
                    </div>
                </div>
            </motion.div>
            <AnimatePresence>
                {previewOpen && (
                    <FormPreviewModal title={title} description={description} fields={fields}
                                      onClose={() => setPreviewOpen(false)}/>
                )}
            </AnimatePresence>
        </div>
    );
}
