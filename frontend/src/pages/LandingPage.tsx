import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {FiArrowRight, FiFileText, FiLink2, FiShield, FiUsers} from "react-icons/fi";

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
    indigo: {bg: "bg-[#EEF0FB]", text: "text-[#3730A3]", border: "border-[#E4E4E7]"},
    purple: {bg: "bg-[#F2EEFA]", text: "text-[#5B3E96]", border: "border-[#E4E4E7]"},
    cyan: {bg: "bg-[#EAF1FB]", text: "text-[#31578F]", border: "border-[#E4E4E7]"},
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
            className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#F7F7F8] px-4 py-16">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5, ease: "easeOut"}}
                className="relative z-10 flex w-full max-w-lg flex-col items-center"
            >
                {/* Brand */}
                <img src="/logo.svg" alt="MarForms" className="mb-6 h-16 w-16 rounded-2xl object-cover"/>

                <h1 className="text-center text-4xl font-bold tracking-tight text-[#1E1E24]">
                    MarForms
                </h1>
                <p className="mt-3 text-center text-base text-[#6B6B76]">
                    {t("landing.subtitle")}
                </p>

                {/* Info card */}
                <div className="mt-8 w-full overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white">
                    <div className="border-b border-[#E4E4E7] px-6 py-5">
                        <div className="flex items-start gap-3">
                            <div
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#FBF3E4]">
                                <FiLink2 size={15} className="text-[#92702A]"/>
                            </div>
                            <div>
                                <p className="font-semibold text-[#1E1E24]">{t("landing.directLinkTitle")}</p>
                                <p className="mt-1.5 text-sm leading-relaxed text-[#6B6B76]">
                                    {t("landing.directLinkDesc")}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-5">
                        <div className="flex items-start gap-3">
                            <div
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#EEF0FB]">
                                <FiShield size={15} className="text-[#3730A3]"/>
                            </div>
                            <div>
                                <p className="font-semibold text-[#1E1E24]">{t("landing.staffTitle")}</p>
                                <p className="mt-1.5 text-sm leading-relaxed text-[#6B6B76]">
                                    {t("landing.staffDesc")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick-open by link */}
                <div className="mt-4 w-full rounded-2xl border border-[#E4E4E7] bg-white px-5 py-4">
                    <p className="mb-3 text-xs font-semibold text-[#8B8B96]">{t("landing.openFormLabel")}</p>
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
                            className="min-w-0 flex-1 rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] px-4 py-2.5 text-sm text-[#1E1E24] placeholder-[#C7C7CE] outline-none transition-colors focus:border-[#3730A3] focus:ring-1 focus:ring-[#3730A3]/20"
                        />
                        <button
                            onClick={handleOpen}
                            className="flex items-center gap-1.5 rounded-xl bg-[#3730A3] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2D2682]"
                        >
                            <FiArrowRight size={14}/>
                            {t("landing.openFormButton")}
                        </button>
                    </div>
                    {error && <p className="mt-2 text-xs text-[#B56A65]">{error}</p>}
                </div>

                {/* How it works */}
                <div className="mt-8 w-full">
                    <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-[#8B8B96]">
                        {t("landing.howItWorks")}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                        {HOW_IT_WORKS.map(({icon: Icon, titleKey, descKey, color}, i) => {
                            const cls = COLOR_MAP[color];
                            return (
                                <div
                                    key={titleKey}
                                    className={`relative flex flex-col gap-2 rounded-xl border ${cls.border} bg-white p-4`}
                                >
                                    <span className="absolute right-3 top-3 text-xs font-bold text-[#D4D4D9]">
                                        0{i + 1}
                                    </span>
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cls.bg}`}>
                                        <Icon size={15} className={cls.text}/>
                                    </div>
                                    <p className="text-xs font-semibold text-[#1E1E24]">{t(titleKey)}</p>
                                    <p className="text-[11px] leading-snug text-[#8B8B96]">{t(descKey)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-10 flex items-center gap-3 text-xs text-[#C7C7CE]">
                    {t("landing.footer")}
                </div>
            </motion.div>
        </div>
    );
}
