import {useEffect, useState} from "react";
import {motion} from "framer-motion";
import {fetchPublicSettings, type PublicSettings} from "../api/settings";
import {FiAlertOctagon, FiMessageCircle, FiSlash} from "react-icons/fi";
import {useTranslation} from "react-i18next";

interface Props {
    message?: string;
    contact?: string;
}

export default function BannedScreen({message, contact}: Props) {
    const {t} = useTranslation();
    const [settings, setSettings] = useState<PublicSettings | null>(null);

    useEffect(() => {
        if (!message && !contact) {
            fetchPublicSettings().then(setSettings);
        }
    }, [message, contact]);

    const displayMessage =
        message ?? settings?.banMessage ?? t("banned.title");
    const displayContact = contact ?? settings?.banAdminContact ?? null;
    const systemName = settings?.systemName ?? "MarForms";

    return (
        <div
            className="relative flex min-h-screen w-full items-center justify-center bg-[#F7F7F8] px-4">
            <motion.div
                initial={{opacity: 0, y: 22}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.45, ease: "easeOut"}}
                className="relative z-10 w-full max-w-[440px]"
            >
                <div
                    className="overflow-hidden rounded-2xl border border-[#EAD4D3] bg-white">
                    <div className="h-1 w-full bg-[#B54B45]"/>

                    <div className="px-8 py-8">
                        {/* Icon + title */}
                        <div className="mb-6 flex flex-col items-center text-center">
                            <div
                                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#EAD4D3] bg-[#F7EEEE]">
                                <FiSlash size={28} className="text-[#8B4A46]"/>
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-[#1E1E24]">
                                {t("banned.title")}
                            </h1>
                            <p className="mt-2 text-sm text-[#6B6B76]">
                                {t("banned.subtitle", {systemName})}
                            </p>
                        </div>

                        <div className="mb-4 h-px w-full bg-[#E4E4E7]"/>

                        {/* Reason */}
                        <div className="mb-3 rounded-xl border border-[#EAD4D3] bg-[#F7EEEE] p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <FiAlertOctagon size={13} className="text-[#B56A65]"/>
                                <span className="text-xs font-semibold uppercase tracking-wider text-[#B56A65]">
                                    {t("banned.restrictionReason")}
                                </span>
                            </div>
                            <p className="text-sm leading-relaxed text-[#8B4A46]">{displayMessage}</p>
                        </div>

                        {/* Contact */}
                        {displayContact && (
                            <div
                                className="flex items-center gap-3 rounded-xl border border-[#E4E4E7] bg-[#F7F7F8] p-4">
                                <div
                                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#F0F0F2]">
                                    <FiMessageCircle size={15} className="text-[#6B6B76]"/>
                                </div>
                                <div>
                                    <p className="text-xs text-[#8B8B96]">{t("banned.contactAppeals")}</p>
                                    <p className="mt-0.5 font-semibold text-[#1E1E24]">{displayContact}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <p className="mt-4 text-center text-xs text-[#C7C7CE]">
                    {t("banned.footer", {systemName})}
                </p>
            </motion.div>
        </div>
    );
}
