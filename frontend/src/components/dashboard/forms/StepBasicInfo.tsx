import {useTranslation} from "react-i18next";
import type {FormDraft} from "./FormWizard";

interface Props {
    draft: FormDraft;
    onChange: (patch: Partial<FormDraft>) => void;
}

const TITLE_MAX = 100;
const DESC_MAX = 500;

const inputCls =
    "w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] px-4 py-3 text-sm text-[#1E1E24] placeholder-[#C7C7CE] outline-none transition-colors focus:border-[#3730A3] focus:bg-white";

export default function StepBasicInfo({draft, onChange}: Props) {
    const {t} = useTranslation();
    const titleLen = draft.title.length;
    const descLen = draft.description.length;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <p className="mb-1 text-xs text-[#8B8B96]">
                    {t("wizard.basicInfo.hint")}
                </p>
            </div>

            {/* Title */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-[#1E1E24]">
                        {t("wizard.basicInfo.titleLabel")} <span className="text-[#B56A65]">*</span>
                    </label>
                    <span className={`text-[10px] tabular-nums transition-colors ${
                        titleLen > TITLE_MAX * 0.9 ? "text-[#C99A3E]" : "text-[#C7C7CE]"
                    }`}>
                        {titleLen} / {TITLE_MAX}
                    </span>
                </div>
                <input
                    type="text"
                    value={draft.title}
                    maxLength={TITLE_MAX}
                    onChange={e => onChange({title: e.target.value})}
                    placeholder={t("wizard.basicInfo.titlePlaceholder")}
                    className={inputCls}
                    autoFocus
                />
                {draft.title.trim().length === 0 && (
                    <p className="mt-1.5 text-[11px] text-[#C7C7CE]">{t("wizard.basicInfo.titleRequired")}</p>
                )}
            </div>

            {/* Description */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-[#1E1E24]">
                        {t("wizard.basicInfo.descLabel")}
                        <span className="ml-1.5 text-[#8B8B96] text-xs font-normal">{t("wizard.basicInfo.descOptional")}</span>
                    </label>
                    <span className={`text-[10px] tabular-nums transition-colors ${
                        descLen > DESC_MAX * 0.9 ? "text-[#C99A3E]" : "text-[#C7C7CE]"
                    }`}>
                        {descLen} / {DESC_MAX}
                    </span>
                </div>
                <textarea
                    value={draft.description}
                    maxLength={DESC_MAX}
                    onChange={e => onChange({description: e.target.value})}
                    placeholder={t("wizard.basicInfo.descPlaceholder")}
                    rows={4}
                    className={`${inputCls} resize-none leading-relaxed`}
                />
                <p className="mt-1.5 text-[11px] text-[#C7C7CE]">
                    {t("wizard.basicInfo.descHint")}
                </p>
            </div>

            {/* Preview card */}
            {draft.title.trim() && (
                <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] p-4">
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">{t("wizard.basicInfo.preview")}</p>
                    <p className="text-sm font-semibold text-[#1E1E24]">{draft.title}</p>
                    {draft.description && (
                        <p className="mt-1 text-xs text-[#6B6B76] leading-relaxed">{draft.description}</p>
                    )}
                </div>
            )}
        </div>
    );
}
