import {useEffect, useState} from "react";
import {Link, Navigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {FiCheck, FiChevronLeft, FiLogIn, FiX} from "react-icons/fi";
import {loginWithDiscord} from "../api/auth";
import {fetchPublicSettings} from "../api/settings";
import {useAuth} from "../hooks/useAuth";
import LanguageSwitch from "../components/LanguageSwitch";

// Docs: docs/design/mockups/Login.dc.html (/login); ТЗ 3.2. The brand panel at
// 1024 px and wider is the split layout of #109; the phone artboard is the card alone.

/** What the sign-in asks Discord for — the scopes of application.properties. */
const SCOPES = ["identify", "guilds"] as const;

function Mark({size}: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
             strokeLinecap="round" aria-hidden="true"><path d="M7 7h10M7 12h10M7 17h5"/></svg>
    );
}

export default function LoginPage() {
    const {t} = useTranslation();
    const {user, loading} = useAuth();
    const [systemName, setSystemName] = useState("MarForms");

    useEffect(() => {
        fetchPublicSettings()
            .then(s => { if (s.systemName) setSystemName(s.systemName); })
            .catch(() => {});
    }, []);

    // Already signed in: straight to the panel or «Мои заявки».
    if (!loading && user) return <Navigate to="/home" replace/>;

    return (
        <div className="flex min-h-screen bg-bg text-tx">
            <aside className="hidden w-[44%] max-w-[620px] flex-col justify-between bg-pr p-12 text-white lg:flex">
                <span className="flex items-center gap-2.5 text-[17px] font-bold">
                    <span className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-white/15"><Mark size={16}/></span>
                    {systemName}
                </span>
                <div className="flex flex-col gap-4">
                    <h2 className="m-0 text-[36px] font-bold leading-[1.1] tracking-[-0.02em]">{t("landing.title")}</h2>
                    <p className="m-0 max-w-[460px] text-base leading-relaxed text-white/80">{t("landing.lead")}</p>
                </div>
                <span className="text-[13px] text-white/70">{t("landing.footer.copyright")}</span>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between px-5 py-4">
                    <Link to="/" className="flex items-center gap-1.5 text-sm text-mu hover:text-tx">
                        <FiChevronLeft size={16} aria-hidden="true"/>{t("login.home")}
                    </Link>
                    <LanguageSwitch/>
                </div>
                <main className="flex flex-1 flex-col justify-center px-5 py-6">
                    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-[18px] rounded-[20px] border border-bd bg-sf px-[22px] py-7">
                        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-pr text-white"><Mark size={24}/></span>
                        <div className="flex flex-col gap-2">
                            <h1 className="m-0 text-2xl font-bold">{t("login.title", {name: systemName})}</h1>
                            <p className="m-0 text-[15px] leading-normal text-mu">{t("login.lead")}</p>
                        </div>
                        <button type="button" onClick={loginWithDiscord}
                                className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] bg-discord text-base font-semibold text-white hover:bg-discord-hover focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
                            <FiLogIn size={20} aria-hidden="true"/>{t("login.continueDiscord")}
                        </button>
                        <div className="flex flex-col gap-2.5 rounded-[14px] bg-s2 p-3.5">
                            <span className="text-[13px] font-semibold">{t("login.scopesTitle")}</span>
                            {SCOPES.map(scope => (
                                <div key={scope} className="flex gap-2.5 text-[13px] leading-snug">
                                    <FiCheck size={16} className="mt-px flex-none text-gnt" aria-hidden="true"/>
                                    <span><span className="font-mono text-xs text-mu">{scope}</span> — {t(`login.scopes.${scope}`)}</span>
                                </div>
                            ))}
                            <div className="flex gap-2.5 text-[13px] leading-snug text-mu">
                                <FiX size={16} className="mt-px flex-none" aria-hidden="true"/>{t("login.noMessages")}
                            </div>
                        </div>
                    </div>
                </main>
                <p className="m-0 px-7 pb-7 text-center text-xs leading-normal text-mu">{t("login.terms")}</p>
            </div>
        </div>
    );
}
