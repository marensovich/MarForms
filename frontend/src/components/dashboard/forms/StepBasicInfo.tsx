import type {FormDraft} from "./FormWizard";

interface Props {
    draft: FormDraft;
    onChange: (patch: Partial<FormDraft>) => void;
}

const TITLE_MAX = 100;
const DESC_MAX = 500;

const inputCls =
    "w-full rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-indigo-500/60 focus:bg-white/[0.06]";

export default function StepBasicInfo({draft, onChange}: Props) {
    const titleLen = draft.title.length;
    const descLen = draft.description.length;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <p className="mb-1 text-xs text-white/30">
                    Give your form a clear, recognizable name. This is what users will see.
                </p>
            </div>

            {/* Title */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-white">
                        Form Title <span className="text-red-400">*</span>
                    </label>
                    <span className={`text-[10px] tabular-nums transition-colors ${
                        titleLen > TITLE_MAX * 0.9 ? "text-amber-400" : "text-white/20"
                    }`}>
                        {titleLen} / {TITLE_MAX}
                    </span>
                </div>
                <input
                    type="text"
                    value={draft.title}
                    maxLength={TITLE_MAX}
                    onChange={e => onChange({title: e.target.value})}
                    placeholder="e.g. Application Form, Staff Interview, Community Survey"
                    className={inputCls}
                    autoFocus
                />
                {draft.title.trim().length === 0 && (
                    <p className="mt-1.5 text-[11px] text-white/25">Required — cannot be empty</p>
                )}
            </div>

            {/* Description */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-white">
                        Description
                        <span className="ml-1.5 text-white/30 text-xs font-normal">optional</span>
                    </label>
                    <span className={`text-[10px] tabular-nums transition-colors ${
                        descLen > DESC_MAX * 0.9 ? "text-amber-400" : "text-white/20"
                    }`}>
                        {descLen} / {DESC_MAX}
                    </span>
                </div>
                <textarea
                    value={draft.description}
                    maxLength={DESC_MAX}
                    onChange={e => onChange({description: e.target.value})}
                    placeholder="Explain the purpose of this form, what it's for, or any instructions for the user filling it out."
                    rows={4}
                    className={`${inputCls} resize-none leading-relaxed`}
                />
                <p className="mt-1.5 text-[11px] text-white/25">
                    Shown at the top of the form page — helps users understand what they're filling out.
                </p>
            </div>

            {/* Preview card */}
            {draft.title.trim() && (
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">Preview</p>
                    <p className="text-sm font-semibold text-white">{draft.title}</p>
                    {draft.description && (
                        <p className="mt-1 text-xs text-white/40 leading-relaxed">{draft.description}</p>
                    )}
                </div>
            )}
        </div>
    );
}
