import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FormField } from "../../../types/forms";
import StepBasicInfo from "./StepBasicInfo";
import StepFields from "./StepFields";
import StepServerSettings from "./StepServerSettings";
import { createForm } from "../../../api/dashboard";

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
}

const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Fields" },
  { id: 3, label: "Server Settings" },
];

const EMPTY_DRAFT: FormDraft = {
  title: "",
  description: "",
  fields: [],
  serverId: "",
  channelsIds: [],
};

export default function FormWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (patch: Partial<FormDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }));
  };

  const handleNext = () => setStep(s => Math.min(s + 1, 3));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await createForm({
        serverId: draft.serverId,
        channelsIds: draft.channelsIds.filter(Boolean),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f0f17] shadow-2xl"
      >
        {/* Шапка с прогрессом */}
        <div className="border-b border-white/10 px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Create Form</h2>
            <button
              onClick={onClose}
              className="text-white/40 transition-colors hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2">
            {STEPS.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      step === s.id
                        ? "bg-indigo-600 text-white"
                        : step > s.id
                        ? "bg-indigo-600/40 text-indigo-300"
                        : "bg-white/10 text-white/40"
                    }`}
                  >
                    {step > s.id ? "✓" : s.id}
                  </div>
                  <span
                    className={`text-xs transition-colors ${
                      step === s.id ? "text-white" : "text-white/40"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="h-px w-8 bg-white/10" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Контент шага */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && (
                <StepBasicInfo draft={draft} onChange={updateDraft} />
              )}
              {step === 2 && (
                <StepFields draft={draft} onChange={updateDraft} />
              )}
              {step === 3 && (
                <StepServerSettings draft={draft} onChange={updateDraft} />
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <p className="mt-4 text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Навигация */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <button
            onClick={step === 1 ? onClose : handleBack}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 transition-colors hover:text-white"
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed(step, draft)}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !canProceed(step, draft)}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Form"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function canProceed(step: number, draft: FormDraft): boolean {
  if (step === 1) return draft.title.trim().length > 0;
  if (step === 2) return draft.fields.length > 0;
  if (step === 3) return draft.serverId.trim().length > 0;
  return true;
}