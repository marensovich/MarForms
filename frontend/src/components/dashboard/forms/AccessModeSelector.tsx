import {useTranslation} from "react-i18next";
import {FiEyeOff, FiGlobe, FiLock, FiShield} from "react-icons/fi";
import type {FormAccessMode} from "../../../types/forms";

const MODES: { mode: FormAccessMode; icon: React.ElementType; available: boolean }[] = [
    {mode: "OPEN", icon: FiGlobe, available: true},
    {mode: "AUTHENTICATED", icon: FiLock, available: true},
    // Visible but disabled until Stage 2 (RoleGate E2.1, anonymous mode E2.3),
    // so the UI doesn't need reworking when they land.
    {mode: "ROLE_GATED", icon: FiShield, available: false},
    {mode: "ANONYMOUS", icon: FiEyeOff, available: false},
];

/** Who may fill the form in (task #46). */
export default function AccessModeSelector({value, onChange}: {
    value: FormAccessMode;
    onChange: (mode: FormAccessMode) => void;
}) {
    const {t} = useTranslation();
    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("access.title")}>
            {MODES.map(({mode, icon: Icon, available}) => {
                const selected = value === mode;
                return (
                    <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!available}
                        onClick={() => available && onChange(mode)}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                            !available
                                ? "cursor-not-allowed border-[#E4E4E7] bg-[#FAFAFB] opacity-60"
                                : selected
                                    ? "border-[#3730A3] bg-[#EEF0FB]"
                                    : "border-[#E4E4E7] bg-white hover:border-[#D4D4D9]"
                        }`}
                    >
                        <Icon size={15} className={`mt-0.5 flex-shrink-0 ${selected ? "text-[#3730A3]" : "text-[#8B8B96]"}`}/>
                        <div className="min-w-0">
                            <p className="flex items-center gap-2 text-sm font-medium text-[#1E1E24]">
                                {t(`access.modes.${mode}.label`)}
                                {!available && (
                                    <span className="rounded-full bg-[#F0F0F2] px-1.5 py-0.5 text-[10px] font-medium text-[#8B8B96]">
                                        {t("access.soon")}
                                    </span>
                                )}
                            </p>
                            <p className="mt-0.5 text-xs text-[#8B8B96]">{t(`access.modes.${mode}.desc`)}</p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
