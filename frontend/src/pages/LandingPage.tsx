import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {SceneBackground} from "../components/LoadingScreen";
import {FiArrowRight, FiFileText, FiLink2, FiShield, FiUsers} from "react-icons/fi";

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
    indigo: {bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/20"},
    purple: {bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/20"},
    cyan: {bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/20"},
};

function extractFormId(input: string): string | null {
    const trimmed = input.trim();
    try {
        const url = new URL(trimmed);
        const match = url.pathname.match(/\/forms\/([^/?#]+)/);
        if (match) return match[1];
    } catch {
        // not a URL — treat as raw ID or path segment
    }
    const pathMatch = trimmed.match(/(?:\/forms\/)?([^/?#\s]+)/);
    return pathMatch ? pathMatch[1] : null;
}

export default function LandingPage() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const [link, setLink] = useState("");
    const [error, setError] = useState("");

    const HOW_IT_WORKS = [
        {icon: FiFileText, titleKey: "landing.step1Title", descKey: "landing.step1Desc", color: "indigo"},
        {icon: FiLink2, titleKey: "landing.step2Title", descKey: "landing.step2Desc", color: "purple"},
        {icon: FiUsers, titleKey: "landing.step3Title", descKey: "landing.step3Desc", color: "cyan"},
    ];

    const handleOpen = () => {
        const id = extractFormId(link);
        if (!id) {
            setError(t("landing.openFormError"));
            return;
        }
        navigate(`/forms/${id}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleOpen();
    };

    return (
        <div
            className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0f0f21] px-4 py-16">
            <SceneBackground/>

            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5, ease: "easeOut"}}
                className="relative z-10 flex w-full max-w-lg flex-col items-center"
            >
                {/* Brand */}
                <div className="relative mb-6">
                    <div className="absolute inset-0 scale-[2.5] rounded-full bg-indigo-500/15 blur-3xl"/>
                    <img src="/logo.png" alt="MarForms"
                         className="relative h-16 w-16 rounded-2xl object-cover shadow-2xl shadow-indigo-500/30"/>
                </div>

                <h1 className="text-center text-4xl font-bold tracking-tight text-white">
                    MarForms
                </h1>
                <p className="mt-3 text-center text-base text-white/60">
                    {t("landing.subtitle")}
                </p>

                {/* Info card */}
                <div className="mt-8 w-full overflow-hidden rounded-2xl border border-white/[0.11] bg-white/[0.05]">
                    <div className="border-b border-white/[0.09] px-6 py-5">
                        <div className="flex items-start gap-3">
                            <div
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                                <FiLink2 size={15} className="text-amber-400"/>
                            </div>
                            <div>
                                <p className="font-semibold text-white">{t("landing.directLinkTitle")}</p>
                                <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                                    {t("landing.directLinkDesc")}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-5">
                        <div className="flex items-start gap-3">
                            <div
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/15">
                                <FiShield size={15} className="text-indigo-400"/>
                            </div>
                            <div>
                                <p className="font-semibold text-white">{t("landing.staffTitle")}</p>
                                <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                                    {t("landing.staffDesc")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick-open by link */}
                <div className="mt-4 w-full rounded-2xl border border-white/[0.11] bg-white/[0.05] px-5 py-4">
                    <p className="mb-3 text-xs font-semibold text-white/50">{t("landing.openFormLabel")}</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={link}
                            onChange={e => {
                                setLink(e.target.value);
                                setError("");
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={t("landing.openFormPlaceholder")}
                            className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                        />
                        <button
                            onClick={handleOpen}
                            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
                        >
                            <FiArrowRight size={14}/>
                            {t("landing.openFormButton")}
                        </button>
                    </div>
                    {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                </div>

                {/* How it works */}
                <div className="mt-8 w-full">
                    <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-white/35">
                        {t("landing.howItWorks")}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        {HOW_IT_WORKS.map(({icon: Icon, titleKey, descKey, color}, i) => {
                            const cls = COLOR_MAP[color];
                            return (
                                <div
                                    key={titleKey}
                                    className={`relative flex flex-col gap-2 rounded-xl border ${cls.border} bg-white/[0.03] p-4`}
                                >
                                    <span className="absolute right-3 top-3 text-xs font-bold text-white/15">
                                        0{i + 1}
                                    </span>
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cls.bg}`}>
                                        <Icon size={15} className={cls.text}/>
                                    </div>
                                    <p className="text-xs font-semibold text-white/80">{t(titleKey)}</p>
                                    <p className="text-[11px] leading-snug text-white/45">{t(descKey)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-10 flex items-center gap-3 text-xs text-white/30">
                    {t("landing.footer")}
                </div>
            </motion.div>
        </div>
    );
}
