import {useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {FiArrowRight, FiInfo, FiLink2} from "react-icons/fi";
import {useAuth} from "../hooks/useAuth";
import {saveRedirectPath} from "../auth/redirectStorage";
import {MY_SUBMISSIONS_PATH, PANEL_PATH, useHasPanel} from "../auth/useHomePath";
import UserMenu from "../shell/UserMenu";
import LanguageSwitch from "../components/LanguageSwitch";
import {cx} from "../ui";
import {parseFormLink} from "./landingLink";

// Docs: docs/design/mockups/LandingDesktop.dc.html (desktop), Main.dc.html (390 px); ТЗ 3.1.

/** Feature icons of the "for server staff" block, in the mockup's order. */
const FEATURES: { key: string; icon: string }[] = [
    {key: "builder", icon: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"},
    {key: "roles", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"},
    {key: "queue", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"},
    {key: "notify", icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"},
    {key: "audit", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"},
    {key: "bans", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"},
];

/** Rows of the product screenshot (decorative). */
const SHOT = [
    {n: "dmitry_ballas", c: "#7C3AED", r: "citizen", rc: "#22C55E", s: "pending"},
    {n: "Ника Sweet", c: "#BE185D", r: "trainee", rc: "#3B82F6", s: "approved"},
    {n: "vlad.kozlov", c: "#0E7490", r: "citizen", rc: "#22C55E", s: "pending"},
    {n: "Arthur_Morgan", c: "#B45309", r: "blacklist", rc: "#EF4444", s: "rejected"},
    {n: "kate_wl", c: "#15803D", r: "trainee", rc: "#3B82F6", s: "approved"},
] as const;

const SHOT_STATUS = {
    pending: "bg-amb text-amt",
    approved: "bg-gnb text-gnt",
    rejected: "bg-rdb text-rdt",
};

function Logo() {
    return (
        <Link to="/" className="flex items-center gap-2.5 text-[17px] font-bold text-tx no-underline">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-pr text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                     strokeLinecap="round" aria-hidden="true"><path d="M7 7h10M7 12h10M7 17h5"/></svg>
            </span>
            MarForms
        </Link>
    );
}

export default function LandingPage() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {user, loading} = useAuth();
    const panel = useHasPanel();
    const [link, setLink] = useState("");
    const [error, setError] = useState(false);

    const open = (e: React.FormEvent) => {
        e.preventDefault();
        const path = parseFormLink(link);
        if (!path) {
            setError(true);
            return;
        }
        navigate(path);
    };

    // "Connect a server" opens the servers page, through sign-in if needed.
    const connect = () => {
        if (!user) saveRedirectPath(PANEL_PATH);
        navigate(user ? PANEL_PATH : "/login");
    };

    const signedIn = !loading && user !== null;
    const panelButton = signedIn && panel && (
        <Link to={PANEL_PATH}
              className="flex h-[38px] items-center rounded-[10px] bg-pr px-4 text-sm font-semibold text-white hover:bg-prh">
            {t("landing.panel")}
        </Link>
    );
    const signIn = !signedIn && !loading && (
        <Link to="/login"
              className="flex h-[38px] items-center rounded-[10px] border border-bd px-4 text-sm font-semibold text-tx hover:bg-s2">
            {t("landing.signIn")}
        </Link>
    );

    return (
        <div className="min-h-screen bg-bg text-tx">
            <header className="border-b border-bd bg-sf">
                <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-7 px-5 md:px-8">
                    <Logo/>
                    <nav aria-label={t("landing.mainMenu")} className="hidden gap-6 text-sm font-medium md:flex">
                        <a href="#how" className="text-tx hover:text-prt">{t("landing.nav.how")}</a>
                        <a href="#staff" className="text-tx hover:text-prt">{t("landing.nav.staff")}</a>
                        <Link to={MY_SUBMISSIONS_PATH} className="text-tx hover:text-prt">{t("landing.nav.mySubmissions")}</Link>
                    </nav>
                    <span className="flex-1"/>
                    <LanguageSwitch/>
                    <div className="hidden items-center gap-2 md:flex">
                        {panelButton}
                        {signIn}
                    </div>
                    {signedIn && <UserMenu variant="topbar"/>}
                </div>
                {/* Phone: the two main actions under the header (Main.dc.html). */}
                <nav aria-label={t("landing.mainMenu")} className="flex gap-2 border-t border-bd px-5 py-2.5 md:hidden">
                    <Link to={MY_SUBMISSIONS_PATH}
                          className="flex h-10 flex-1 items-center justify-center rounded-[10px] border border-bd text-sm font-medium text-tx">
                        {t("landing.nav.mySubmissions")}
                    </Link>
                    {!signedIn && !loading && (
                        <Link to="/login"
                              className="flex h-10 flex-1 items-center justify-center rounded-[10px] bg-pr text-sm font-semibold text-white">
                            {t("landing.signIn")}
                        </Link>
                    )}
                    {signedIn && panel && (
                        <Link to={PANEL_PATH}
                              className="flex h-10 flex-1 items-center justify-center rounded-[10px] bg-pr text-sm font-semibold text-white">
                            {t("landing.panel")}
                        </Link>
                    )}
                </nav>
            </header>

            <section className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-14 px-5 pb-16 pt-10 md:px-8 md:pb-[72px] md:pt-[88px]">
                <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-[22px]">
                    <span className="self-start rounded-full bg-prs px-3 py-[5px] text-[13px] font-semibold text-prt">
                        {t("landing.badge")}
                    </span>
                    <h1 className="m-0 text-[36px] font-bold leading-[1.08] tracking-[-0.03em] md:text-[52px]">
                        {t("landing.title")}
                    </h1>
                    <p className="m-0 max-w-[520px] text-base leading-relaxed text-mu md:text-lg">{t("landing.lead")}</p>
                    <form role="search" onSubmit={open} className="flex max-w-[560px] flex-col gap-2">
                        <label htmlFor="open-link" className="text-sm font-semibold">{t("landing.openLabel")}</label>
                        <div className={cx("flex gap-2 rounded-[14px] border bg-sf p-1.5 shadow-[0_8px_24px_rgba(30,30,60,0.06)]",
                            error ? "border-dg" : "border-bd focus-within:border-pr")}>
                            <span className="grid place-items-center pl-2.5 text-mu"><FiLink2 size={18} aria-hidden="true"/></span>
                            <input id="open-link" value={link} autoComplete="off"
                                   onChange={e => {
                                       setLink(e.target.value);
                                       setError(false);
                                   }}
                                   aria-invalid={error || undefined}
                                   aria-describedby={error ? "open-link-error" : "open-link-hint"}
                                   placeholder={t("landing.openPlaceholder")}
                                   className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base text-tx outline-none placeholder:text-mu"/>
                            <button type="submit"
                                    className="flex h-11 items-center gap-2 rounded-[10px] bg-pr px-5 text-[15px] font-semibold text-white hover:bg-prh">
                                {t("landing.openButton")}<FiArrowRight size={16} aria-hidden="true"/>
                            </button>
                        </div>
                        {error && <span id="open-link-error" className="text-[13px] text-rdt">{t("landing.openError")}</span>}
                        <span id="open-link-hint" className="flex items-center gap-1.5 text-[13px] text-mu">
                            <FiInfo size={14} aria-hidden="true" className="flex-none"/>{t("landing.noCatalog")}
                        </span>
                    </form>
                </div>

                <div role="img" aria-label={t("landing.shotLabel")}
                     className="hidden min-w-0 flex-[1_1_560px] overflow-hidden rounded-[18px] border border-bd bg-sf shadow-[0_30px_80px_rgba(30,30,80,0.14)] lg:block">
                    <div className="flex h-9 items-center gap-1.5 border-b border-bd bg-bg px-3.5" aria-hidden="true">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#F87171]"/>
                        <span className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]"/>
                        <span className="h-2.5 w-2.5 rounded-full bg-[#34D399]"/>
                    </div>
                    <div className="flex" aria-hidden="true">
                        <div className="flex w-[130px] flex-col gap-1.5 border-r border-bd px-2.5 py-3.5">
                            <span className="h-2.5 w-[70px] rounded bg-pr"/>
                            <span className="mt-2 h-6 rounded-md bg-prs"/>
                            <span className="mx-1.5 mt-2 h-2 w-20 rounded bg-s2"/>
                            <span className="mx-1.5 mt-1 h-2 w-16 rounded bg-s2"/>
                            <span className="mx-1.5 mt-1 h-2 w-[90px] rounded bg-s2"/>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-3.5">
                            <span className="text-[13px] font-bold">{t("landing.shot.title")}</span>
                            {SHOT.map(s => (
                                <div key={s.n} className="flex items-center gap-2.5 rounded-[10px] border border-bd px-2.5 py-2 text-xs">
                                    <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white"
                                          style={{background: s.c}}>{s.n[0].toUpperCase()}</span>
                                    <span className="flex-1 font-semibold">{s.n}</span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-bd px-1.5 py-0.5 text-[10px]">
                                        <span className="h-1.5 w-1.5 rounded-full" style={{background: s.rc}}/>{t(`landing.shot.${s.r}`)}
                                    </span>
                                    <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-bold", SHOT_STATUS[s.s])}>
                                        {t(`landing.shot.${s.s}`)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="flex w-[180px] flex-col gap-2 border-l border-bd bg-bg p-3.5">
                            <span className="text-xs font-bold">dmitry_ballas</span>
                            <span className="h-2 rounded bg-s2"/>
                            <span className="h-2 w-4/5 rounded bg-s2"/>
                            <span className="h-10 rounded-lg bg-s2"/>
                            <span className="mt-auto h-7 rounded-lg bg-[#16A34A]"/>
                            <span className="h-7 rounded-lg border border-bd"/>
                        </div>
                    </div>
                </div>
            </section>

            <section id="how" className="border-y border-bd bg-sf">
                <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 py-14 md:px-8 md:py-[72px]">
                    <h2 className="m-0 text-2xl tracking-[-0.02em] md:text-[32px]">{t("landing.how.title")}</h2>
                    <ol className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-3">
                        {[1, 2, 3].map(n => (
                            <li key={n} className="flex flex-col gap-2.5 rounded-2xl border border-bd p-6">
                                <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-prs font-bold text-prt">{n}</span>
                                <strong className="text-lg">{t(`landing.how.step${n}Title`)}</strong>
                                <span className="text-[15px] leading-relaxed text-mu">{t(`landing.how.step${n}Desc`)}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section id="staff" className="mx-auto flex max-w-[1280px] flex-col gap-8 px-5 py-16 md:px-8 md:py-20">
                <div className="flex flex-wrap items-end justify-between gap-5">
                    <div className="flex max-w-[620px] flex-col gap-2.5">
                        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-prt">{t("landing.staff.eyebrow")}</span>
                        <h2 className="m-0 text-2xl tracking-[-0.02em] md:text-[32px]">{t("landing.staff.title")}</h2>
                    </div>
                    <button type="button" onClick={connect}
                            className="flex h-12 items-center rounded-xl bg-pr px-[22px] text-[15px] font-semibold text-white hover:bg-prh">
                        {t("landing.staff.connect")}
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map(f => (
                        <div key={f.key} className="flex flex-col gap-2.5 rounded-2xl border border-bd bg-sf p-6">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-prs text-prt">
                                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={f.icon}/></svg>
                            </span>
                            <strong className="text-[17px]">{t(`landing.staff.${f.key}Title`)}</strong>
                            <span className="text-sm leading-relaxed text-mu">{t(`landing.staff.${f.key}Desc`)}</span>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="border-t border-bd bg-sf">
                <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-6 px-5 py-8 text-[13px] text-mu md:px-8">
                    <span>{t("landing.footer.copyright")}</span>
                    <nav aria-label={t("landing.footer.label")} className="flex flex-wrap gap-5">
                        {(["terms", "privacy", "support", "status"] as const).map(k => (
                            <a key={k} href="#" className="text-mu underline hover:text-tx">{t(`landing.footer.${k}`)}</a>
                        ))}
                    </nav>
                </div>
            </footer>
        </div>
    );
}
