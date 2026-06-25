import {motion} from "framer-motion";
import {loginWithDiscord} from "../api/auth";
import {SceneBackground} from "../components/LoadingScreen";
import {FaDiscord} from "react-icons/fa";
import {FiFileText, FiShield, FiZap} from "react-icons/fi";
import {useTranslation} from "react-i18next";
import {fetchPublicSettings} from "../api/settings";
import {useEffect, useState} from "react";

const FEATURE_ICONS = [FiFileText, FiShield, FiZap];
const FEATURE_KEYS = ["formBuilder", "roleControl", "instantDelivery"] as const;

export default function LoginPage() {
    const {t} = useTranslation();
    const [systemName, setSystemName] = useState("MarForms");

    useEffect(() => {
        fetchPublicSettings()
            .then(s => { if (s.systemName) setSystemName(s.systemName); })
            .catch(() => {});
    }, []);

    return (
        <div
            className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0f0f21] px-4 py-16">
            <SceneBackground/>

            <motion.div
                initial={{opacity: 0, y: 22}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.55, ease: "easeOut"}}
                className="relative z-10 flex w-full max-w-[420px] flex-col items-center"
            >
                {/* Logo */}
                <div className="relative mb-7">
                    <div className="absolute inset-0 scale-[2] rounded-full bg-indigo-500/20 blur-3xl"/>
                    <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-indigo-500/25">
                        <img
                            src="/logo.png"
                            alt={systemName}
                            className="h-[90px] w-[90px] object-cover"
                        />
                    </div>
                </div>

                {/* Headline */}
                <div className="mb-8 text-center">
                    <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-white">
                        {t("login.welcome")}{" "}
                        <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            {systemName}
                        </span>
                    </h1>
                    <p className="mt-2.5 text-[0.9rem] leading-relaxed text-white/65">
                        {t("login.tagline")}
                    </p>
                </div>

                {/* Login card */}
                <div
                    className="w-full overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-xl">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent"/>

                    <div className="p-6">
                        <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-white/40">
                            {t("login.signInLabel")}
                        </p>

                        <motion.button
                            onClick={loginWithDiscord}
                            whileHover={{scale: 1.025}}
                            whileTap={{scale: 0.975}}
                            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-[#5865F2] px-6 py-4 font-semibold text-white shadow-xl shadow-[#5865F2]/30 transition-colors hover:bg-[#4752C4] focus:outline-none focus:ring-2 focus:ring-[#5865F2]/60 focus:ring-offset-2 focus:ring-offset-[#0f0f21]"
                        >
                            <FaDiscord size={20} className="flex-shrink-0"/>
                            <span>{t("login.continueDiscord")}</span>
                        </motion.button>

                        <p className="mt-4 text-center text-xs text-white/35">
                            {t("login.terms")}
                        </p>
                    </div>
                </div>

                {/* Feature pills */}
                <div className="mt-6 grid w-full grid-cols-3 gap-2.5">
                    {FEATURE_KEYS.map((key, i) => {
                        const Icon = FEATURE_ICONS[i];
                        return (
                            <div
                                key={key}
                                className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] p-3 text-center"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15">
                                    <Icon size={15} className="text-indigo-400"/>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-white/80">{t(`login.features.${key}`)}</p>
                                    <p className="mt-0.5 text-[11px] leading-snug text-white/45">{t(`login.features.${key}Desc`)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p className="mt-8 text-xs text-white/30">
                    {t("login.footer")}
                </p>
            </motion.div>
        </div>
    );
}
