import {useEffect, useState} from "react";
import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {FiAlertCircle, FiCheckCircle, FiEdit3, FiFileText, FiLink, FiLoader, FiSave, FiX,} from "react-icons/fi";
import type {DashboardForm, UpdateFormPayload} from "../../../api/dashboard";
import {getForm, updateForm} from "../../../api/dashboard";
import type {FormDefinition, WebhookConfig} from "../../../types/forms";
import StepWebhooks from "./StepWebhooks";

interface Props {
    form: DashboardForm;
    onClose: () => void;
    onUpdated: () => void;
}

type Tab = "basic" | "webhooks";

function inputCls(error?: boolean) {
    return `w-full rounded-xl border px-4 py-2.5 text-sm text-[#1E1E24] placeholder-[#C7C7CE] outline-none transition-colors focus:ring-1 ${
        error
            ? "border-[#EAD4D3] bg-[#F7EEEE] focus:border-[#B56A65] focus:ring-[#B56A65]/20"
            : "border-[#E4E4E7] bg-[#FAFAFB] focus:border-[#3730A3] focus:ring-[#3730A3]/20"
    }`;
}

export default function FormEditModal({form, onClose, onUpdated}: Props) {
    const {t} = useTranslation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>("basic");
    const [definition, setDefinition] = useState<FormDefinition | null>(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);

    useEffect(() => {
        getForm(form.id)
            .then(def => {
                setDefinition(def);
                setTitle(def.schema.title);
                setDescription(def.schema.description ?? "");
                setWebhooks(def.webhooks ?? []);
            })
            .catch(() => setError(t("formEdit.loadError")))
            .finally(() => setLoading(false));
    }, [form.id]);

    const handleSave = async () => {
        if (!definition) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const payload: UpdateFormPayload = {
                schema: {
                    title: title.trim(),
                    description,
                    fields: definition.schema.fields,
                },
                webhooks: webhooks.filter(w => w.url.trim()),
            };
            await updateForm(form.id, payload);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            onUpdated();
        } catch (e) {
            setError(e instanceof Error ? e.message : t("formEdit.saveError"));
        } finally {
            setSaving(false);
        }
    };

    const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
        {id: "basic", label: t("formEdit.tabs.basicInfo"), icon: <FiFileText size={13}/>},
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
                className="flex w-full max-w-[580px] flex-col rounded-2xl border border-[#E4E4E7] bg-white shadow-xl"
                style={{maxHeight: "calc(100vh - 2rem)"}}
            >
                {/* Header */}
                <div className="flex-shrink-0 border-b border-[#E4E4E7] px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D8DCF5] bg-[#EEF0FB]">
                                <FiEdit3 size={14} className="text-[#3730A3]"/>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-[#1E1E24]">{t("formEdit.title")}</p>
                                <p className="text-xs text-[#8B8B96] font-mono">{form.id.slice(0, 8)}…</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8B8B96] transition-colors hover:bg-[#F0F0F2] hover:text-[#1E1E24]"
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
                                        ? "bg-[#F0F0F2] text-[#1E1E24]"
                                        : "text-[#8B8B96] hover:text-[#55555F]"
                                }`}
                            >
                                {tabItem.icon}
                                {tabItem.label}
                                {tabItem.count !== undefined && tabItem.count > 0 && (
                                    <span
                                        className="rounded-full bg-[#EEF0FB] px-1.5 py-0.5 text-[10px] text-[#3730A3]">
                                        {tabItem.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <FiLoader size={20} className="animate-spin text-[#8B8B96]"/>
                        </div>
                    ) : error && !definition ? (
                        <div
                            className="flex items-center gap-2 rounded-xl border border-[#EAD4D3] bg-[#F7EEEE] px-4 py-3 text-sm text-[#8B4A46]">
                            <FiAlertCircle size={14}/>{error}
                        </div>
                    ) : (
                        <>
                            {tab === "basic" && (
                                <div className="flex flex-col gap-4">
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-[#6B6B76]">{t("formEdit.formTitle")}</span>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder={t("formEdit.titlePlaceholder")}
                                            className={inputCls(!title.trim())}
                                        />
                                        {!title.trim() && (
                                            <p className="flex items-center gap-1 text-[11px] text-[#B56A65]">
                                                <FiAlertCircle size={10}/> {t("formEdit.titleRequired")}
                                            </p>
                                        )}
                                    </label>

                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-[#6B6B76]">{t("formEdit.description")}</span>
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder={t("formEdit.descPlaceholder")}
                                            rows={4}
                                            className={`${inputCls()} resize-none`}
                                        />
                                    </label>

                                    {definition && (
                                        <div
                                            className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] px-4 py-3">
                                            <p className="text-xs font-medium text-[#8B8B96] mb-2">{t("formEdit.fields")}</p>
                                            <div className="flex flex-col gap-1.5">
                                                {definition.schema.fields.map(f => (
                                                    <div key={f.id}
                                                         className="flex items-center gap-2 text-xs text-[#6B6B76]">
                                                        <span
                                                            className="h-1 w-1 rounded-full bg-[#D4D4D9] flex-shrink-0"/>
                                                        <span className="font-medium text-[#55555F]">{f.label}</span>
                                                        <span className="text-[#C7C7CE]">{f.type.toLowerCase()}</span>
                                                        {f.required &&
                                                            <span className="text-[#B56A65]">required</span>}
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="mt-2.5 text-[11px] text-[#C7C7CE]">
                                                {t("formEdit.fieldEditNote")}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {tab === "webhooks" && (
                                <StepWebhooks
                                    draft={{
                                        title,
                                        description,
                                        fields: definition?.schema.fields ?? [],
                                        serverId: definition ? String(definition.serverId) : "",
                                        channelsIds: [],
                                        webhooks,
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
                <div className="flex-shrink-0 flex items-center justify-between border-t border-[#E4E4E7] px-6 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-[#E4E4E7] px-4 py-2 text-sm text-[#8B8B96] transition-colors hover:border-[#D4D4D9] hover:text-[#1E1E24]"
                    >
                        {t("common.cancel")}
                    </button>

                    <div className="flex items-center gap-3">
                        {error && definition && (
                            <div className="flex items-center gap-1.5 text-xs text-[#B56A65]">
                                <FiAlertCircle size={12}/>{error}
                            </div>
                        )}
                        {saved && (
                            <div className="flex items-center gap-1.5 text-xs text-[#3F6B4A]">
                                <FiCheckCircle size={12}/>{t("formEdit.saved")}
                            </div>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving || loading || !title.trim()}
                            className="flex items-center gap-2 rounded-xl bg-[#3730A3] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2D2682] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {saving
                                ? <><FiLoader size={13} className="animate-spin"/>{t("formEdit.saving")}</>
                                : <><FiSave size={13}/>{t("formEdit.save")}</>
                            }
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
