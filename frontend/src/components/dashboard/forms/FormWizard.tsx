import {useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {FiAlertCircle, FiCheck, FiChevronRight, FiX} from "react-icons/fi";
import {useTranslation} from "react-i18next";
import type {FormField, WebhookConfig} from "../../../types/forms";
import StepBasicInfo from "./StepBasicInfo";
import StepFields from "./StepFields";
import StepServerSettings from "./StepServerSettings";
import StepWebhooks from "./StepWebhooks";
import {createForm} from "../../../api/dashboard";

interface Props {
    onClose: () => void;
    onCreated: () => void;
}

export interface FormDraft {
    title: string;
    description: string;
    fields: FormField[];
    serverId: string;
    channelsIds: string[];
    webhooks: WebhookConfig[];
}

const STEPS = [
    {id: 1, labelKey: "wizard.steps.basicInfo", descKey: "wizard.steps.basicInfoDesc"},
    {id: 2, labelKey: "wizard.steps.fields", descKey: "wizard.steps.fieldsDesc"},
    {id: 3, labelKey: "wizard.steps.discord", descKey: "wizard.steps.discordDesc"},
    {id: 4, labelKey: "wizard.steps.webhooks", descKey: "wizard.steps.webhooksDesc"},
] as const;

const EMPTY_DRAFT: FormDraft = {
    title: "",
    description: "",
    fields: [],
    serverId: "",
    channelsIds: [],
    webhooks: [],
};

function canProceed(step: number, draft: FormDraft): boolean {
    if (step === 1) return draft.title.trim().length > 0;
    if (step === 2) return draft.fields.length > 0;
    if (step === 3) return draft.serverId.trim().length > 0;
    return true;
}

export default function FormWizard({onClose, onCreated}: Props) {
    const {t} = useTranslation();
    const [step, setStep] = useState(1);
    const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateDraft = (patch: Partial<FormDraft>) =>
        setDraft(prev => ({...prev, ...patch}));

    const handleNext = () => {
        setError(null);
        setStep(s => Math.min(s + 1, 4));
    };
    const handleBack = () => {
        setError(null);
        setStep(s => Math.max(s - 1, 1));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await createForm({
                serverId: draft.serverId,
                channelsIds: draft.channelsIds.filter(Boolean),
                webhooks: draft.webhooks.filter(w => w.url.trim()),
                schema: {
                    title: draft.title,
                    description: draft.description,
                    fields: draft.fields,
                },
            });
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create form");
        } finally {
            setSubmitting(false);
        }
    };

    const isFieldsStep = step === 2;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <motion.div
                initial={{opacity: 0, scale: 0.95, y: 8}}
                animate={{opacity: 1, scale: 1, y: 0}}
                exit={{opacity: 0, scale: 0.95, y: 8}}
                transition={{duration: 0.2}}
                className={`flex w-full flex-col rounded-2xl border border-white/[0.09] bg-[#0f0f17] shadow-2xl shadow-black/50 transition-all duration-200 ${
                    isFieldsStep ? "max-w-[960px]" : "max-w-[520px]"
                }`}
                style={{maxHeight: "calc(100vh - 2rem)"}}
            >
                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex-shrink-0 border-b border-white/[0.08] px-6 py-4">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-white">{t("wizard.create")}</h2>
                        <button
                            onClick={onClose}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                            <FiX size={14}/>
                        </button>
                    </div>

                    {/* Step indicator */}
                    <div className="flex items-center gap-1.5">
                        {STEPS.map((s, idx) => {
                            const done = step > s.id;
                            const current = step === s.id;
                            return (
                                <div key={s.id} className="flex items-center gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-all ${
                                                done ? "bg-indigo-500 text-white" :
                                                    current ? "bg-indigo-600 text-white ring-2 ring-indigo-500/25 ring-offset-1 ring-offset-[#0f0f17]" :
                                                        "bg-white/[0.08] text-white/25"
                                            }`}>
                                            {done ? <FiCheck size={9}/> : s.id}
                                        </div>
                                        <div>
                                            <p className={`text-[11px] font-medium transition-colors leading-tight ${current ? "text-white" : "text-white/30"}`}>
                                                {t(s.labelKey)}
                                            </p>
                                            <p className="text-[10px] text-white/20 leading-tight">{t(s.descKey)}</p>
                                        </div>
                                    </div>
                                    {idx < STEPS.length - 1 && (
                                        <FiChevronRight size={11} className="mx-1 text-white/15"/>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Step content ────────────────────────────────────── */}
                <div className="flex-1 min-h-0 overflow-x-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{opacity: 0, x: 12}}
                            animate={{opacity: 1, x: 0}}
                            exit={{opacity: 0, x: -12}}
                            transition={{duration: 0.16}}
                            className="h-full flex flex-col"
                        >
                            {step === 1 && (
                                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                                    <StepBasicInfo draft={draft} onChange={updateDraft}/>
                                </div>
                            )}
                            {step === 2 && (
                                <StepFields draft={draft} onChange={updateDraft}/>
                            )}
                            {step === 3 && (
                                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                                    <StepServerSettings draft={draft} onChange={updateDraft}/>
                                </div>
                            )}
                            {step === 4 && (
                                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                                    <StepWebhooks draft={draft} onChange={updateDraft}/>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ── Footer ─────────────────────────────────────────── */}
                <div className="flex-shrink-0 flex items-center justify-between border-t border-white/[0.08] px-6 py-4">
                    <button
                        onClick={step === 1 ? onClose : handleBack}
                        className="rounded-xl border border-white/[0.09] px-4 py-2 text-sm text-white/40 transition-colors hover:border-white/20 hover:text-white"
                    >
                        {step === 1 ? t("wizard.cancel") : t("wizard.back")}
                    </button>

                    <div className="flex items-center gap-3">
                        {error && (
                            <div className="flex items-center gap-1.5 text-xs text-red-400">
                                <FiAlertCircle size={12}/>
                                {error}
                            </div>
                        )}
                        {step < 4 ? (
                            <button
                                onClick={handleNext}
                                disabled={!canProceed(step, draft)}
                                className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {t("wizard.next")}
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !canProceed(3, draft)}
                                className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {submitting ? t("wizard.creating") : t("wizard.create")}
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
