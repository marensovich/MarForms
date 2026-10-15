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
            className="relative flex min-h-screen w-full items-center justify-center bg-s2 px-4">
            <motion.div
                initial={{opacity: 0, y: 22}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.45, ease: "easeOut"}}
                className="relative z-10 w-full max-w-[440px]"
            >
                <div
                    className="overflow-hidden rounded-2xl border border-rdb bg-sf">
                    <div className="h-1 w-full bg-dg"/>

                    <div className="px-8 py-8">
                        {/* Icon + title */}
                        <div className="mb-6 flex flex-col items-center text-center">
                            <div
                                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-rdb bg-rdb">
                                <FiSlash size={28} className="text-rdt"/>
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-tx">
                                {t("banned.title")}
                            </h1>
                            <p className="mt-2 text-sm text-mu">
                                {t("banned.subtitle", {systemName})}
                            </p>
                        </div>

                        <div className="mb-4 h-px w-full bg-bd"/>

                        {/* Reason */}
                        <div className="mb-3 rounded-xl border border-rdb bg-rdb p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <FiAlertOctagon size={13} className="text-rdt"/>
                                <span className="text-xs font-semibold uppercase tracking-wider text-rdt">
                                    {t("banned.restrictionReason")}
                                </span>
                            </div>
                            <p className="text-sm leading-relaxed text-rdt">{displayMessage}</p>
                        </div>

                        {/* Contact */}
                        {displayContact && (
                            <div
                                className="flex items-center gap-3 rounded-xl border border-bd bg-s2 p-4">
                                <div
                                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-s2">
                                    <FiMessageCircle size={15} className="text-mu"/>
                                </div>
                                <div>
                                    <p className="text-xs text-mu">{t("banned.contactAppeals")}</p>
                                    <p className="mt-0.5 font-semibold text-tx">{displayContact}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <p className="mt-4 text-center text-xs text-mu/70">
                    {t("banned.footer", {systemName})}
                </p>
            </motion.div>
        </div>
    );
}
