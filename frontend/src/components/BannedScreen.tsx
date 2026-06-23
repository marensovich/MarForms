import {useEffect, useState} from "react";
import {motion} from "framer-motion";
import {fetchPublicSettings, type PublicSettings} from "../api/settings";
import {BackgroundGlow} from "./LoadingScreen";

interface Props {
    message?: string;
    contact?: string;
}

export default function BannedScreen({message, contact}: Props) {
    const [settings, setSettings] = useState<PublicSettings | null>(null);

    useEffect(() => {
        if (!message && !contact) {
            fetchPublicSettings().then(setSettings);
        }
    }, [message, contact]);

    const displayMessage = message ?? settings?.banMessage ?? "You are banned.";
    const displayContact = contact ?? settings?.banAdminContact ?? "Administrator";

    return (
        <div
            className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a0f] px-4">
            <BackgroundGlow/>
            <motion.div
                initial={{opacity: 0, y: 16}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.45, ease: "easeOut"}}
                className="relative z-10 w-full max-w-md rounded-2xl border border-red-500/20 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10"
            >
                <div className="mb-4 text-5xl">🚫</div>
                <h1 className="text-2xl font-semibold text-white">Access Restricted</h1>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                    {displayMessage}
                </p>
                {displayContact && (
                    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs text-white/40">Contact administrator</p>
                        <p className="mt-1 font-medium text-white">{displayContact}</p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}