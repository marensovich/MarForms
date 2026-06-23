import type { FormDraft } from "./FormWizard";

interface Props {
  draft: FormDraft;
  onChange: (patch: Partial<FormDraft>) => void;
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-indigo-500";

export default function StepBasicInfo({ draft, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-white">
          Form Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={draft.title}
          onChange={e => onChange({ title: e.target.value })}
          placeholder="e.g. Application Form"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-white">
          Description
        </label>
        <textarea
          value={draft.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Brief description of the form's purpose..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
    </div>
  );
}