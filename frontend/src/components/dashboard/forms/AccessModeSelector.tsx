import {useState} from "react";
import {AnimatePresence} from "framer-motion";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiEyeOff, FiGlobe, FiLock, FiShield} from "react-icons/fi";
import type {FormAccessMode} from "../../../types/forms";
import {Modal} from "../shared";

const MODES: { mode: FormAccessMode; icon: React.ElementType; available: boolean }[] = [
    {mode: "OPEN", icon: FiGlobe, available: true},
    {mode: "AUTHENTICATED", icon: FiLock, available: true},
    {mode: "ROLE_GATED", icon: FiShield, available: true},
    {mode: "ANONYMOUS", icon: FiEyeOff, available: true},
];

/**
 * Spec раздел 5.6: anonymous mode turns off author verification, a
 * deliberate trade-off, never a default. It can only be switched on through
 * this dialog, by ticking the acknowledgement (task #72).
 */
function AnonymousWarningModal({onConfirm, onCancel}: { onConfirm: () => void; onCancel: () => void }) {
    const {t} = useTranslation();
    const [acknowledged, setAcknowledged] = useState(false);
    return (
        <Modal title={t("access.anonymousWarning.title")} onClose={onCancel} width="max-w-md">
            <div className="mb-4 flex gap-3 rounded-lg border border-[#EFDFC0] bg-[#FBF3E4] p-3 text-sm text-[#92702A]">
                <FiAlertTriangle size={18} className="mt-0.5 flex-shrink-0"/>
                <p>{t("access.anonymousWarning.lead")}</p>
            </div>
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-[#55555F]">
                <li>{t("access.anonymousWarning.points.noVerification")}</li>
                <li>{t("access.anonymousWarning.points.noIdentity")}</li>
                <li>{t("access.anonymousWarning.points.noBans")}</li>
                <li>{t("access.anonymousWarning.points.limit")}</li>
            </ul>
            <label className="mb-5 flex cursor-pointer items-start gap-2 text-sm text-[#1E1E24]">
                <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}
                       className="mt-0.5 accent-[#3730A3]"/>
                {t("access.anonymousWarning.acknowledge")}
            </label>
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel}
                        className="rounded-lg border border-[#E4E4E7] px-4 py-2 text-sm text-[#55555F] transition-colors hover:text-[#1E1E24]">
                    {t("common.cancel")}
                </button>
                <button type="button" onClick={onConfirm} disabled={!acknowledged}
                        className="rounded-lg bg-[#3730A3] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2D2682] disabled:cursor-not-allowed disabled:opacity-40">
                    {t("access.anonymousWarning.confirm")}
                </button>
            </div>
        </Modal>
    );
}

/** Who may fill the form in (task #46). */
export default function AccessModeSelector({value, onChange}: {
    value: FormAccessMode;
    onChange: (mode: FormAccessMode) => void;
}) {
    const {t} = useTranslation();
    const [confirmingAnonymous, setConfirmingAnonymous] = useState(false);

    const select = (mode: FormAccessMode) => {
        if (mode === "ANONYMOUS" && value !== "ANONYMOUS") {
            setConfirmingAnonymous(true);
            return;
        }
        onChange(mode);
    };

    return (
        <>
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
                            onClick={() => available && select(mode)}
                            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                                !available
                                    ? "cursor-not-allowed border-[#E4E4E7] bg-[#FAFAFB] opacity-60"
                                    : selected
                                        ? "border-[#3730A3] bg-[#EEF0FB]"
                                        : "border-[#E4E4E7] bg-white hover:border-[#D4D4D9]"
                            }`}
                        >
                            <Icon size={15}
                                  className={`mt-0.5 flex-shrink-0 ${selected ? "text-[#3730A3]" : "text-[#8B8B96]"}`}/>
                            <div className="min-w-0">
                                <p className="flex items-center gap-2 text-sm font-medium text-[#1E1E24]">
                                    {t(`access.modes.${mode}.label`)}
                                    {!available && (
                                        <span
                                            className="rounded-full bg-[#F0F0F2] px-1.5 py-0.5 text-[10px] font-medium text-[#8B8B96]">
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

            {value === "ANONYMOUS" && (
                <div className="mt-2 flex gap-2 rounded-lg border border-[#EFDFC0] bg-[#FBF3E4] px-3 py-2 text-xs text-[#92702A]">
                    <FiAlertTriangle size={13} className="mt-0.5 flex-shrink-0"/>
                    {t("access.anonymousWarning.banner")}
                </div>
            )}

            <AnimatePresence>
                {confirmingAnonymous && (
                    <AnonymousWarningModal
                        onCancel={() => setConfirmingAnonymous(false)}
                        onConfirm={() => {
                            setConfirmingAnonymous(false);
                            onChange("ANONYMOUS");
                        }}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
