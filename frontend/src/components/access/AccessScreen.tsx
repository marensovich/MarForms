import {type ReactNode, useState} from "react";
import {useTranslation} from "react-i18next";
import {
    FiAlertCircle,
    FiArchive,
    FiBell,
    FiCheck,
    FiClock,
    FiLock,
    FiRefreshCw,
    FiSearch,
    FiShield,
    FiSlash,
    FiUserPlus,
    FiXCircle,
} from "react-icons/fi";
import {Link, useNavigate} from "react-router-dom";
import {type AccessDetails, remindWhenOpen} from "../../api/forms";
import {loginWithDiscord} from "../../api/auth";
import {saveRedirectPath} from "../../auth/redirectStorage";
import {useAuth} from "../../hooks/useAuth";
import {Button, cx, DiscordLogo, discordColor, RoleChip, ServerIcon} from "../../ui";
import {type AccessAction, type AccessIcon, type AccessScreenCode, ACCESS_SCREENS, type AccessTone, technicalCode} from "./accessConfig";

// Docs: docs/design/mockups/AccessDesktop.dc.html (1440) and AccessStates.dc.html (390); ТЗ 3.5.

const ICONS: Record<AccessIcon, ReactNode> = {
    lock: <FiLock/>, user: <FiUserPlus/>, ban: <FiSlash/>, shield: <FiShield/>, x: <FiXCircle/>, refresh: <FiRefreshCw/>,
    clock: <FiClock/>, box: <FiArchive/>, search: <FiSearch/>, alert: <FiAlertCircle/>, check: <FiCheck/>,
};

const TONES: Record<AccessTone, string> = {
    primary: "bg-prs text-prt",
    amber: "bg-amb text-amt",
    red: "bg-rdb text-rdt",
    neutral: "bg-s2 text-mu",
};

export interface AccessScreenProps {
    code: AccessScreenCode;
    details?: AccessDetails;
    /** The form, when known: server line and texts that name the server. */
    form?: { slug: string; title: string; guildName: string | null; guildIconUrl: string | null };
    /** ERROR: HTTP status and request id for the technical line. */
    error?: { status?: number; correlationId?: string };
    /** "Повторить" / "Проверить роли снова". */
    onRetry?: () => void;
    /** ACCOUNT_RESTRICTED: the platform's text for restricted users. */
    restrictionMessage?: string;
    /** NOT_OPEN_YET: the viewer already asked to be reminded (#121). */
    reminderSet?: boolean;
}

export default function AccessScreen({code, details, form, error, onRetry, restrictionMessage, reminderSet}: AccessScreenProps) {
    const {t, i18n} = useTranslation();
    const navigate = useNavigate();
    const {user, logout} = useAuth();
    const [reminder, setReminder] = useState<"idle" | "busy" | "set" | "failed">(reminderSet ? "set" : "idle");
    const config = ACCESS_SCREENS[code];
    const locale = i18n?.language || "ru";
    const server = form?.guildName ?? t("accessScreen.theServer");

    const formatDate = (iso?: string) => iso
        ? new Intl.DateTimeFormat(locale, {day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"}).format(new Date(iso))
        : null;
    const date = formatDate(code === "NOT_OPEN_YET" ? details?.opensAt : details?.closesAt);
    const textKey = code === "FORM_CLOSED" && !date ? "accessScreen.FORM_CLOSED.textNoDate" : `accessScreen.${code}.text`;
    const text = code === "ACCOUNT_RESTRICTED" && restrictionMessage ? restrictionMessage : t(textKey, {server, date});

    const showReason = code === "GUILD_BANNED" || code === "ACCOUNT_RESTRICTED";
    const until = details?.until ? formatDate(details.until) : t("accessScreen.permanent");
    const roles = (code === "ROLE_REQUIRED" || code === "ROLE_DENIED") ? details?.roles ?? [] : [];

    const run = (action: AccessAction) => {
        switch (action) {
            case "login":
                if (form) saveRedirectPath(`/f/${form.slug}`);
                loginWithDiscord();
                return;
            case "checkRoles":
            case "retry":
                onRetry?.();
                return;
            case "mySubmissions":
                navigate(details?.previousSubmissionId ? `/me/submissions?submission=${details.previousSubmissionId}` : "/me/submissions");
                return;
            case "previousSubmission":
                navigate(`/me/submissions?submission=${details?.previousSubmissionId ?? ""}`);
                return;
            case "home":
                navigate("/");
                return;
            case "logout":
                logout();
                return;
            case "otherLink":
                navigate("/");
                return;
            case "remind":
                if (!form) return;
                // Signed out: sign in first, then come back to this form.
                if (!user) {
                    saveRedirectPath(`/f/${form.slug}`);
                    loginWithDiscord();
                    return;
                }
                setReminder("busy");
                remindWhenOpen(form.slug).then(() => setReminder("set")).catch(() => setReminder("failed"));
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-bg font-sans text-tx">
            <header className="border-b border-bd bg-sf">
                <div className="mx-auto flex h-[60px] max-w-[1280px] items-center gap-4 px-4 sm:px-8">
                    <Link to="/" className="flex items-center gap-2.5 text-base font-bold text-tx no-underline">
                        <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-pr text-white" aria-hidden="true">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M7 7h10M7 12h10M7 17h5"/></svg>
                        </span>
                        MarForms
                    </Link>
                    <span className="flex-1"/>
                    <Link to="/me/submissions" className="text-sm font-medium text-tx no-underline hover:text-prt">{t("shell.mySubmissions")}</Link>
                </div>
            </header>

            <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:px-6 sm:py-16">
                <div className="flex w-full max-w-[560px] flex-col gap-4">
                    {config.server && form && (
                        <span className="flex items-center gap-2.5 self-start text-sm text-mu sm:self-center">
                            <ServerIcon name={form.guildName} src={form.guildIconUrl} size={28}/>
                            {[form.guildName, form.title].filter(Boolean).join(" · ")}
                        </span>
                    )}
                    <section aria-labelledby="access-title"
                             className="flex flex-col items-start gap-3.5 rounded-[20px] border border-bd bg-sf p-6 text-left sm:items-center sm:p-10 sm:text-center">
                        <span aria-hidden="true" className={cx("grid h-14 w-14 place-items-center rounded-[18px] text-[26px] sm:h-16 sm:w-16 sm:rounded-[20px] sm:text-[28px]", TONES[config.tone])}>
                            {ICONS[config.icon]}
                        </span>
                        <span className={cx("rounded-full px-[11px] py-1 text-xs font-bold", TONES[config.tone])}>{t(`accessScreen.${code}.badge`)}</span>
                        <h1 id="access-title" className="m-0 text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[26px]">{t(`accessScreen.${code}.title`)}</h1>
                        <p className="m-0 max-w-[440px] text-[15px] leading-relaxed text-mu">{text}</p>

                        {roles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 sm:justify-center">
                                {roles.map(r => <RoleChip key={r.id} name={r.name ?? r.id} color={discordColor(r.color)}/>)}
                            </div>
                        )}

                        {showReason && (
                            <dl className="m-0 grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-bg px-4 py-3.5 text-left text-[13px]">
                                {details?.reason && <><dt className="text-mu">{t("accessScreen.reason")}</dt><dd className="m-0 font-semibold">{details.reason}</dd></>}
                                <dt className="text-mu">{t("accessScreen.until")}</dt><dd className="m-0 font-semibold">{until}</dd>
                                {details?.appealsContact && <>
                                    <dt className="text-mu">{t("accessScreen.appeals")}</dt>
                                    <dd className="m-0 font-semibold text-prt">{details.appealsContact}</dd>
                                </>}
                            </dl>
                        )}

                        <div className="mt-2 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
                            {config.primary === "login" ? (
                                <Button variant="discord" size="lg" onClick={() => run("login")} icon={<DiscordLogo size={20}/>} className="w-full sm:w-auto">
                                    {t("accessScreen.actions.login")}
                                </Button>
                            ) : config.primary === "remind" ? (form && (
                                <Button size="lg" onClick={() => run("remind")} disabled={reminder === "set"} loading={reminder === "busy"}
                                        icon={reminder === "set" ? <FiCheck aria-hidden="true"/> : <FiBell aria-hidden="true"/>}
                                        className="w-full sm:w-auto">
                                    {t(reminder === "set" ? "accessScreen.actions.reminded" : "accessScreen.actions.remind")}
                                </Button>
                            )) : config.primary && (config.primary !== "previousSubmission" || details?.previousSubmissionId) && (
                                <Button size="lg" onClick={() => run(config.primary!)} className="w-full sm:w-auto">
                                    {t(`accessScreen.actions.${config.primary}`)}
                                </Button>
                            )}
                            <Button variant="secondary" size="lg" onClick={() => run(config.secondary)} className="w-full font-medium sm:w-auto">
                                {t(`accessScreen.actions.${config.secondary}`)}
                            </Button>
                        </div>
                        {reminder === "failed" && (
                            <p role="alert" className="m-0 text-[13px] text-rdt">{t("accessScreen.remindFailed")}</p>
                        )}
                    </section>
                    <span className="self-center font-mono text-xs text-mu">{technicalCode(code, error)}</span>
                </div>
            </main>
        </div>
    );
}
