import {useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import ThemeToggle from "../theme/ThemeToggle";
import {FiArrowRight, FiFileText, FiLink2, FiShield, FiUsers} from "react-icons/fi";
import {useAuth} from "../hooks/useAuth";

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
    indigo: {bg: "bg-prs", text: "text-prt", border: "border-bd"},
    purple: {bg: "bg-prs", text: "text-prt", border: "border-bd"},
    cyan: {bg: "bg-inb", text: "text-int", border: "border-bd"},
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
    const {user} = useAuth();
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
            className="relative flex min-h-screen w-full flex-col items-center justify-center bg-s2 px-4 py-16">
            <div className="absolute right-4 top-4 z-20"><ThemeToggle/></div>
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5, ease: "easeOut"}}
                className="relative z-10 flex w-full max-w-lg flex-col items-center"
            >
                {/* Brand */}
                <img src="/logo.svg" alt="MarForms" className="mb-6 h-16 w-16 rounded-2xl object-cover"/>

                <h1 className="text-center text-4xl font-bold tracking-tight text-tx">
                    MarForms
                </h1>
                <p className="mt-3 text-center text-base text-mu">
                    {t("landing.subtitle")}
                </p>

                {/* Info card */}
                <div className="mt-8 w-full overflow-hidden rounded-2xl border border-bd bg-sf">
                    <div className="border-b border-bd px-6 py-5">
                        <div className="flex items-start gap-3">
                            <div
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amb">
                                <FiLink2 size={15} className="text-amt"/>
                            </div>
                            <div>
                                <p className="font-semibold text-tx">{t("landing.directLinkTitle")}</p>
                                <p className="mt-1.5 text-sm leading-relaxed text-mu">
                                    {t("landing.directLinkDesc")}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-5">
                        <div className="flex items-start gap-3">
                            <div
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-prs">
                                <FiShield size={15} className="text-prt"/>
                            </div>
                            <div>
                                <p className="font-semibold text-tx">{t("landing.staffTitle")}</p>
                                <p className="mt-1.5 text-sm leading-relaxed text-mu">
                                    {t("landing.staffDesc")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick-open by link */}
                <div className="mt-4 w-full rounded-2xl border border-bd bg-sf px-5 py-4">
                    <p className="mb-3 text-xs font-semibold text-mu">{t("landing.openFormLabel")}</p>
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
                            className="min-w-0 flex-1 rounded-xl border border-bd bg-bg px-4 py-2.5 text-sm text-tx placeholder-mu/70 outline-none transition-colors focus:border-pr focus:ring-1 focus:ring-pr/20"
                        />
                        <button
                            onClick={handleOpen}
                            className="flex items-center gap-1.5 rounded-xl bg-pr px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-prh"
                        >
                            <FiArrowRight size={14}/>
                            {t("landing.openFormButton")}
                        </button>
                    </div>
                    {error && <p className="mt-2 text-xs text-rdt">{error}</p>}
                </div>

                {/* How it works */}
                <div className="mt-8 w-full">
                    <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-mu">
                        {t("landing.howItWorks")}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        {HOW_IT_WORKS.map(({icon: Icon, titleKey, descKey, color}, i) => {
                            const cls = COLOR_MAP[color];
                            return (
                                <div
                                    key={titleKey}
                                    className={`relative flex flex-col gap-2 rounded-xl border ${cls.border} bg-sf p-4`}
                                >
                                    <span className="absolute right-3 top-3 text-xs font-bold text-mu">
                                        0{i + 1}
                                    </span>
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cls.bg}`}>
                                        <Icon size={15} className={cls.text}/>
                                    </div>
                                    <p className="text-xs font-semibold text-tx">{t(titleKey)}</p>
                                    <p className="text-[11px] leading-snug text-mu">{t(descKey)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {user && (
                    <Link to="/me/submissions" className="mt-8 text-sm font-medium text-prt hover:text-prt">
                        {t("landing.mySubmissions")}
                    </Link>
                )}

                <div className="mt-10 flex items-center gap-3 text-xs text-mu/70">
                    {t("landing.footer")}
                </div>
            </motion.div>
        </div>
    );
}
