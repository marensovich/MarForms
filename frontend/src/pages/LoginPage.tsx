import {motion} from "framer-motion";
import {loginWithDiscord} from "../api/auth";
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
            className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#F7F7F8] px-4 py-16">
            <motion.div
                initial={{opacity: 0, y: 22}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.55, ease: "easeOut"}}
                className="relative z-10 flex w-full max-w-[420px] flex-col items-center"
            >
                {/* Logo */}
                <img
                    src="/logo.svg"
                    alt={systemName}
                    className="mb-7 h-[90px] w-[90px] rounded-2xl object-cover"
                />

                {/* Headline */}
                <div className="mb-8 text-center">
                    <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-[#1E1E24]">
                        {t("login.welcome")}{" "}
                        <span className="text-[#3730A3]">
                            {systemName}
                        </span>
                    </h1>
                    <p className="mt-2.5 text-[0.9rem] leading-relaxed text-[#6B6B76]">
                        {t("login.tagline")}
                    </p>
                </div>

                {/* Login card */}
                <div
                    className="w-full overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white">
                    <div className="p-6">
                        <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-[#8B8B96]">
                            {t("login.signInLabel")}
                        </p>

                        <motion.button
                            onClick={loginWithDiscord}
                            whileHover={{scale: 1.015}}
                            whileTap={{scale: 0.985}}
                            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-[#5865F2] px-6 py-4 font-semibold text-white transition-colors hover:bg-[#4752C4] focus:outline-none focus:ring-2 focus:ring-[#5865F2]/40 focus:ring-offset-2 focus:ring-offset-white"
                        >
                            <FaDiscord size={20} className="flex-shrink-0"/>
                            <span>{t("login.continueDiscord")}</span>
                        </motion.button>

                        <p className="mt-4 text-center text-xs text-[#8B8B96]">
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
                                className="flex flex-col items-center gap-2 rounded-xl border border-[#E4E4E7] bg-white p-3 text-center"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF0FB]">
                                    <Icon size={15} className="text-[#3730A3]"/>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-[#1E1E24]">{t(`login.features.${key}`)}</p>
                                    <p className="mt-0.5 text-[11px] leading-snug text-[#8B8B96]">{t(`login.features.${key}Desc`)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p className="mt-8 text-xs text-[#C7C7CE]">
                    {t("login.footer")}
                </p>
            </motion.div>
        </div>
    );
}
