import {motion} from "framer-motion";
import {loginWithDiscord} from "../api/auth";
import {FaDiscord} from "react-icons/fa";
import {FiFileText, FiShield, FiZap} from "react-icons/fi";
import {useTranslation} from "react-i18next";
import {fetchPublicSettings} from "../api/settings";
import {useEffect, useState} from "react";
import {Navigate} from "react-router-dom";
import {useAuth} from "../hooks/useAuth";

const FEATURE_ICONS = [FiFileText, FiShield, FiZap];
const FEATURE_KEYS = ["formBuilder", "roleControl", "instantDelivery"] as const;

export default function LoginPage() {
    const {t} = useTranslation();
    const [systemName, setSystemName] = useState("MarForms");
    const {user, loading} = useAuth();

    useEffect(() => {
        fetchPublicSettings()
            .then(s => { if (s.systemName) setSystemName(s.systemName); })
            .catch(() => {});
    }, []);

    // Already signed in: straight to the panel or «Мои заявки».
    if (!loading && user) return <Navigate to="/home" replace/>;

    return (
        <div
            className="relative flex min-h-screen w-full flex-col items-center justify-center bg-s2 px-4 py-16">
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
                    <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-tx">
                        {t("login.welcome")}{" "}
                        <span className="text-prt">
                            {systemName}
                        </span>
                    </h1>
                    <p className="mt-2.5 text-[0.9rem] leading-relaxed text-mu">
                        {t("login.tagline")}
                    </p>
                </div>

                {/* Login card */}
                <div
                    className="w-full overflow-hidden rounded-2xl border border-bd bg-sf">
                    <div className="p-6">
                        <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-mu">
                            {t("login.signInLabel")}
                        </p>

                        <motion.button
                            onClick={loginWithDiscord}
                            whileHover={{scale: 1.015}}
                            whileTap={{scale: 0.985}}
                            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-discord px-6 py-4 font-semibold text-white transition-colors hover:bg-discord-hover focus:outline-none focus:ring-2 focus:ring-discord/40 focus:ring-offset-2 focus:ring-offset-white"
                        >
                            <FaDiscord size={20} className="flex-shrink-0"/>
                            <span>{t("login.continueDiscord")}</span>
                        </motion.button>

                        <p className="mt-4 text-center text-xs text-mu">
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
                                className="flex flex-col items-center gap-2 rounded-xl border border-bd bg-sf p-3 text-center"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-prs">
                                    <Icon size={15} className="text-prt"/>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-tx">{t(`login.features.${key}`)}</p>
                                    <p className="mt-0.5 text-[11px] leading-snug text-mu">{t(`login.features.${key}Desc`)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p className="mt-8 text-xs text-mu/70">
                    {t("login.footer")}
                </p>
            </motion.div>
        </div>
    );
}
