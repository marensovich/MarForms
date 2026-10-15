import {useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {FiAlertCircle, FiCheck, FiChevronRight, FiEye, FiX} from "react-icons/fi";
import {useTranslation} from "react-i18next";
import type {FormAccessMode, FormField, WebhookConfig} from "../../../types/forms";
import StepBasicInfo from "./StepBasicInfo";
import StepFields from "./StepFields";
import StepServerSettings from "./StepServerSettings";
import StepWebhooks from "./StepWebhooks";
import {createForm, createGuildForm} from "../../../api/dashboard";
import AccessModeSelector from "./AccessModeSelector";
import RoleGateEditor from "./RoleGateEditor";
import FormPreviewModal from "./FormPreviewModal";

interface Props {
    onClose: () => void;
    onCreated: () => void;
    /**
     * Owner-panel mode: the form is created in this guild as a DRAFT (via
     * the guild-scoped API) and published later from the forms list.
     * Without it, the legacy admin flow publishes immediately.
     */
    guildId?: string;
}

export interface FormDraft {
    title: string;
    description: string;
    reviewTime: string;
    fields: FormField[];
    serverId: string;
    channelsIds: string[];
    webhooks: WebhookConfig[];
    accessMode: FormAccessMode;
    allowedRoleIds: string[];
    deniedRoleIds: string[];
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
    reviewTime: "",
    fields: [],
    serverId: "",
    channelsIds: [],
    webhooks: [],
    accessMode: "AUTHENTICATED",
    allowedRoleIds: [],
    deniedRoleIds: [],
};

/** A ROLE_GATED form needs at least one rule; the server refuses it otherwise. */
function roleGateIncomplete(draft: FormDraft): boolean {
    return draft.accessMode === "ROLE_GATED" && draft.allowedRoleIds.length === 0 && draft.deniedRoleIds.length === 0;
}

function canProceed(step: number, draft: FormDraft): boolean {
    if (step === 1) return draft.title.trim().length > 0;
    if (step === 2) return draft.fields.length > 0;
    if (step === 3) return draft.serverId.trim().length > 0 && !roleGateIncomplete(draft);
    return true;
}

export default function FormWizard({onClose, onCreated, guildId}: Props) {
    const {t} = useTranslation();
    const [step, setStep] = useState(1);
    const [draft, setDraft] = useState<FormDraft>({...EMPTY_DRAFT, serverId: guildId ?? ""});
    const [previewOpen, setPreviewOpen] = useState(false);
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
            if (guildId) {
                await createGuildForm(guildId, {
                    channelsIds: draft.channelsIds.filter(Boolean),
                    webhooks: draft.webhooks.filter(w => w.url.trim()),
                    accessMode: draft.accessMode,
                    allowedRoleIds: draft.allowedRoleIds,
                    deniedRoleIds: draft.deniedRoleIds,
                    schema: {title: draft.title, description: draft.description, reviewTime: draft.reviewTime.trim() || null, fields: draft.fields},
                });
                onCreated();
                return;
            }
            await createForm({
                serverId: draft.serverId,
                channelsIds: draft.channelsIds.filter(Boolean),
                webhooks: draft.webhooks.filter(w => w.url.trim()),
                schema: {
                    title: draft.title,
                    description: draft.description,
                    reviewTime: draft.reviewTime.trim() || null,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
                initial={{opacity: 0, scale: 0.95, y: 8}}
                animate={{opacity: 1, scale: 1, y: 0}}
                exit={{opacity: 0, scale: 0.95, y: 8}}
                transition={{duration: 0.2}}
                className={`flex w-full flex-col rounded-2xl border border-bd bg-sf shadow-xl transition-all duration-200 ${
                    isFieldsStep ? "max-w-[960px]" : "max-w-[520px]"
                }`}
                style={{maxHeight: "calc(100vh - 2rem)"}}
            >
                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex-shrink-0 border-b border-bd px-6 py-4">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-tx">{t("wizard.create")}</h2>
                        <button
                            onClick={onClose}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-mu transition-colors hover:bg-s2 hover:text-tx"
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
                                                done ? "bg-pr text-white" :
                                                    current ? "bg-pr text-white ring-2 ring-prs ring-offset-1 ring-offset-white" :
                                                        "bg-s2 text-mu"
                                            }`}>
                                            {done ? <FiCheck size={9}/> : s.id}
                                        </div>
                                        <div>
                                            <p className={`text-[11px] font-medium transition-colors leading-tight ${current ? "text-tx" : "text-mu"}`}>
                                                {t(s.labelKey)}
                                            </p>
                                            <p className="text-[10px] text-mu/70 leading-tight">{t(s.descKey)}</p>
                                        </div>
                                    </div>
                                    {idx < STEPS.length - 1 && (
                                        <FiChevronRight size={11} className="mx-1 text-mu"/>
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
                                    <StepServerSettings draft={draft} onChange={updateDraft} lockServer={!!guildId}/>
                                    {guildId && (
                                        <div className="mt-6">
                                            <p className="mb-2 text-sm font-medium text-tx">{t("access.title")}</p>
                                            <AccessModeSelector value={draft.accessMode}
                                                                onChange={accessMode => updateDraft({accessMode})}/>
                                            {draft.accessMode === "ROLE_GATED" && (
                                                <RoleGateEditor guildId={guildId}
                                                                value={{allowedRoleIds: draft.allowedRoleIds, deniedRoleIds: draft.deniedRoleIds}}
                                                                onChange={updateDraft}/>
                                            )}
                                        </div>
                                    )}
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
                <div className="flex-shrink-0 flex items-center justify-between border-t border-bd px-6 py-4">
                    <button
                        onClick={step === 1 ? onClose : handleBack}
                        className="rounded-xl border border-bd px-4 py-2 text-sm text-mu transition-colors hover:border-bd hover:text-tx"
                    >
                        {step === 1 ? t("wizard.cancel") : t("wizard.back")}
                    </button>

                    <div className="flex items-center gap-3">
                        {draft.fields.length > 0 && (
                            <button
                                onClick={() => setPreviewOpen(true)}
                                className="flex items-center gap-1.5 rounded-xl border border-bd px-3 py-2 text-sm text-mu transition-colors hover:border-bd hover:text-tx"
                            >
                                <FiEye size={13}/>
                                {t("preview.open")}
                            </button>
                        )}
                        {error && (
                            <div className="flex items-center gap-1.5 text-xs text-rdt">
                                <FiAlertCircle size={12}/>
                                {error}
                            </div>
                        )}
                        {step < 4 ? (
                            <button
                                onClick={handleNext}
                                disabled={!canProceed(step, draft)}
                                className="rounded-xl bg-pr px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-prh disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {t("wizard.next")}
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !canProceed(3, draft)}
                                className="rounded-xl bg-pr px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-prh disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {submitting ? t("wizard.creating") : guildId ? t("wizard.createDraft") : t("wizard.create")}
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
            <AnimatePresence>
                {previewOpen && (
                    <FormPreviewModal title={draft.title} description={draft.description} fields={draft.fields}
                                      onClose={() => setPreviewOpen(false)}/>
                )}
            </AnimatePresence>
        </div>
    );
}
