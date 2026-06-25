import {useEffect, useState} from "react";
import {motion} from "framer-motion";
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
    return `w-full rounded-xl border px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:ring-1 ${
        error
            ? "border-red-500/50 bg-red-500/[0.04] focus:border-red-500/60 focus:ring-red-500/20"
            : "border-white/[0.08] bg-white/[0.04] focus:border-indigo-500/60 focus:ring-indigo-500/30"
    }`;
}

export default function FormEditModal({form, onClose, onUpdated}: Props) {
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
            .catch(() => setError("Failed to load form data."))
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
            setError(e instanceof Error ? e.message : "Save failed.");
        } finally {
            setSaving(false);
        }
    };

    const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
        {id: "basic", label: "Basic Info", icon: <FiFileText size={13}/>},
        {
            id: "webhooks",
            label: "Webhooks",
            icon: <FiLink size={13}/>,
            count: webhooks.filter(w => w.url.trim()).length
        },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <motion.div
                initial={{opacity: 0, scale: 0.96, y: 8}}
                animate={{opacity: 1, scale: 1, y: 0}}
                exit={{opacity: 0, scale: 0.96, y: 8}}
                transition={{duration: 0.18}}
                className="flex w-full max-w-[580px] flex-col rounded-2xl border border-white/[0.09] bg-[#0f0f17] shadow-2xl shadow-black/50"
                style={{maxHeight: "calc(100vh - 2rem)"}}
            >
                {/* Header */}
                <div className="flex-shrink-0 border-b border-white/[0.08] px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10">
                                <FiEdit3 size={14} className="text-indigo-400"/>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">Edit Form</p>
                                <p className="text-xs text-white/35 font-mono">{form.id.slice(0, 8)}…</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                            <FiX size={14}/>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="mt-4 flex gap-1">
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                    tab === t.id
                                        ? "bg-white/[0.08] text-white"
                                        : "text-white/35 hover:text-white/60"
                                }`}
                            >
                                {t.icon}
                                {t.label}
                                {t.count !== undefined && t.count > 0 && (
                                    <span
                                        className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300">
                                        {t.count}
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
                            <FiLoader size={20} className="animate-spin text-white/30"/>
                        </div>
                    ) : error && !definition ? (
                        <div
                            className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                            <FiAlertCircle size={14}/>{error}
                        </div>
                    ) : (
                        <>
                            {tab === "basic" && (
                                <div className="flex flex-col gap-4">
                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-white/50">Form title</span>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder="Enter form title"
                                            className={inputCls(!title.trim())}
                                        />
                                        {!title.trim() && (
                                            <p className="flex items-center gap-1 text-[11px] text-red-400">
                                                <FiAlertCircle size={10}/> Title is required
                                            </p>
                                        )}
                                    </label>

                                    <label className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-white/50">Description</span>
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="Optional form description"
                                            rows={4}
                                            className={`${inputCls()} resize-none`}
                                        />
                                    </label>

                                    {definition && (
                                        <div
                                            className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                                            <p className="text-xs font-medium text-white/35 mb-2">Fields</p>
                                            <div className="flex flex-col gap-1.5">
                                                {definition.schema.fields.map(f => (
                                                    <div key={f.id}
                                                         className="flex items-center gap-2 text-xs text-white/55">
                                                        <span
                                                            className="h-1 w-1 rounded-full bg-white/20 flex-shrink-0"/>
                                                        <span className="font-medium text-white/70">{f.label}</span>
                                                        <span className="text-white/25">{f.type.toLowerCase()}</span>
                                                        {f.required &&
                                                            <span className="text-red-400/60">required</span>}
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="mt-2.5 text-[11px] text-white/20">
                                                Field editing is not yet supported — recreate the form to change field
                                                structure.
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
                                        serverId: "",
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
                <div className="flex-shrink-0 flex items-center justify-between border-t border-white/[0.08] px-6 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-white/[0.09] px-4 py-2 text-sm text-white/40 transition-colors hover:border-white/20 hover:text-white"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-3">
                        {error && definition && (
                            <div className="flex items-center gap-1.5 text-xs text-red-400">
                                <FiAlertCircle size={12}/>{error}
                            </div>
                        )}
                        {saved && (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                                <FiCheckCircle size={12}/>Saved
                            </div>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving || loading || !title.trim()}
                            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {saving
                                ? <><FiLoader size={13} className="animate-spin"/>Saving…</>
                                : <><FiSave size={13}/>Save changes</>
                            }
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
