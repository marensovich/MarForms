import {useEffect, useState} from "react";
import {motion} from "framer-motion";
import {fetchPublicSettings, type PublicSettings} from "../api/settings";
import {SceneBackground} from "./LoadingScreen";
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
            className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0f0f21] px-4">
            <SceneBackground variant="danger"/>

            <motion.div
                initial={{opacity: 0, y: 22}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.45, ease: "easeOut"}}
                className="relative z-10 w-full max-w-[440px]"
            >
                <div
                    className="overflow-hidden rounded-2xl border border-red-500/25 bg-[#1a0a10] shadow-2xl shadow-red-900/30">
                    <div className="h-1 w-full bg-gradient-to-r from-red-700 via-red-500 to-transparent"/>

                    <div className="px-8 py-8">
                        {/* Icon + title */}
                        <div className="mb-6 flex flex-col items-center text-center">
                            <div className="relative mb-4">
                                <div className="absolute inset-0 scale-[2] rounded-full bg-red-500/15 blur-2xl"/>
                                <div
                                    className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/15">
                                    <FiSlash size={28} className="text-red-400"/>
                                </div>
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-white">
                                {t("banned.title")}
                            </h1>
                            <p className="mt-2 text-sm text-white/60">
                                {t("banned.subtitle", {systemName})}
                            </p>
                        </div>

                        <div
                            className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"/>

                        {/* Reason */}
                        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/[0.08] p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <FiAlertOctagon size={13} className="text-red-400/80"/>
                                <span className="text-xs font-semibold uppercase tracking-wider text-red-400/70">
                                    {t("banned.restrictionReason")}
                                </span>
                            </div>
                            <p className="text-sm leading-relaxed text-white/75">{displayMessage}</p>
                        </div>

                        {/* Contact */}
                        {displayContact && (
                            <div
                                className="flex items-center gap-3 rounded-xl border border-white/[0.10] bg-white/[0.04] p-4">
                                <div
                                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.08]">
                                    <FiMessageCircle size={15} className="text-white/55"/>
                                </div>
                                <div>
                                    <p className="text-xs text-white/45">{t("banned.contactAppeals")}</p>
                                    <p className="mt-0.5 font-semibold text-white">{displayContact}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <p className="mt-4 text-center text-xs text-white/25">
                    {t("banned.footer", {systemName})}
                </p>
            </motion.div>
        </div>
    );
}
