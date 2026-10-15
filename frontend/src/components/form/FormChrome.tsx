import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiCheck, FiClock, FiUser} from "react-icons/fi";
import {Link} from "react-router-dom";
import {useAuth} from "../../hooks/useAuth";
import {Avatar, Button, cx, ServerIcon} from "../../ui";
import type {FillProgress} from "./layout";

// Public form page parts (docs/design/mockups/FormDesktop.dc.html 1440, FormPublic.dc.html 390; ТЗ 3.3).

export interface FormMeta {
    guildName?: string | null;
    guildIconUrl?: string | null;
    closesAt?: string | null;
    submissionLimitPerUser?: number | null;
    guildId?: string | null;
}

function Logo() {
    return (
        <Link to="/" className="flex items-center gap-2.5 text-[15px] font-bold text-tx no-underline sm:text-base">
            <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-pr text-white" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M7 7h10M7 12h10M7 17h5"/></svg>
            </span>
            MarForms
        </Link>
    );
}

/** Top bar; long forms get the progress strip under it, sticky (ФТ-3.3.3). */
export function FormHeader({progress}: { progress?: FillProgress | null }) {
    const {t} = useTranslation();
    const {user} = useAuth();
    const pct = progress && progress.total ? Math.round((progress.answered / progress.total) * 100) : 0;
    return (
        <header className="sticky top-0 z-30 border-b border-bd bg-sf">
            <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 sm:h-[60px] sm:px-8">
                <Logo/>
                <span className="flex-1"/>
                <Link to="/me/submissions" className="text-sm font-medium text-prt no-underline hover:underline sm:text-tx">{t("shell.mySubmissions")}</Link>
                {user && (
                    <span className="flex items-center gap-2 text-sm font-semibold text-tx">
                        <Avatar name={user.discordUsername} src={user.avatarUrl} size={30}/>
                        <span className="hidden sm:inline">{user.discordUsername}</span>
                    </span>
                )}
            </div>
            {progress && (
                <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 pb-2.5 text-xs text-mu sm:px-0">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-s2" role="progressbar" aria-valuemin={0}
                          aria-valuemax={progress.total} aria-valuenow={progress.answered} aria-label={t("form.progressLabel")}>
                        <span className="block h-full bg-pr transition-[width]" style={{width: `${pct}%`}}/>
                    </span>
                    <span className="whitespace-nowrap">
                        {progress.sections > 1 && <>{t("form.sectionOf", {n: progress.section, total: progress.sections})} · </>}
                        {t("form.fieldsOf", {n: progress.answered, total: progress.total})}
                    </span>
                </div>
            )}
        </header>
    );
}

function InfoBadge({tone = "neutral", icon, children}: { tone?: "amber" | "neutral" | "red"; icon?: ReactNode; children: ReactNode }) {
    return (
        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-xs font-semibold",
            tone === "amber" && "bg-amb text-amt", tone === "red" && "bg-rdb text-rdt", tone === "neutral" && "bg-s2 text-tx")}>
            {icon}{children}
        </span>
    );
}

/** Server, title, description and info badges (ФТ-3.3.1, 3.3.2). */
export function FormIntro({title, description, meta, minutes, anonymous}: {
    title: string;
    description?: string;
    meta?: FormMeta;
    minutes: number;
    anonymous: boolean;
}) {
    const {t, i18n} = useTranslation();
    const {user} = useAuth();
    const closes = meta?.closesAt
        ? new Intl.DateTimeFormat(i18n?.language || "ru", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})
            .format(new Date(meta.closesAt))
        : null;
    return (
        <section className="flex flex-col gap-3.5 border-b border-bd bg-sf px-4 py-5 sm:gap-3 sm:rounded-2xl sm:border sm:px-8 sm:py-7">
            {meta?.guildName && (
                <span className="flex items-center gap-2.5 text-sm font-semibold text-tx">
                    <ServerIcon name={meta.guildName} src={meta.guildIconUrl} size={32}/>
                    {meta.guildName}
                </span>
            )}
            <h1 className="m-0 text-[26px] font-bold leading-tight tracking-[-0.01em] sm:text-[30px] sm:tracking-[-0.02em]">{title}</h1>
            {description && <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed text-mu">{description}</p>}
            <div className="flex flex-wrap gap-2">
                {closes && <InfoBadge tone="amber" icon={<FiClock size={13} aria-hidden="true"/>}>{t("form.badge.closes", {date: closes})}</InfoBadge>}
                {meta?.submissionLimitPerUser != null && (
                    <InfoBadge>{t("form.badge.limit", {count: meta.submissionLimitPerUser})}</InfoBadge>
                )}
                <InfoBadge>{t("form.badge.minutes", {count: minutes})}</InfoBadge>
                {anonymous && <InfoBadge tone="red">{t("form.badge.anonymous")}</InfoBadge>}
            </div>
            {anonymous ? (
                <div className="flex gap-2.5 rounded-xl bg-amb p-3 text-[13px] leading-snug text-amt">
                    <FiAlertTriangle size={16} className="mt-0.5 flex-none" aria-hidden="true"/>
                    <span><b>{t("form.anonymousTitle")}</b> {t("form.anonymousText")}</span>
                </div>
            ) : user && (
                <span className="flex items-center gap-2 text-[13px] text-mu">
                    <FiUser size={14} aria-hidden="true"/>
                    {t("form.answeringAs")} <b className="text-tx">@{user.discordUsername}</b>
                </span>
            )}
        </section>
    );
}

/** Sticky bottom bar: fields with errors, draft status, submit (ФТ-3.3.7). */
export function SubmitBar({errorCount, draftSavedAt, submitting, preview, onSubmit, submitError}: {
    errorCount: number;
    draftSavedAt: Date | null;
    submitting: boolean;
    preview: boolean;
    onSubmit: () => void;
    submitError?: string | null;
}) {
    const {t, i18n} = useTranslation();
    return (
        <div className="sticky bottom-0 z-30 border-t border-bd bg-sf">
            <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-0 sm:py-3.5">
                <span className="min-w-0 flex-1 text-[13px] font-medium" aria-live="polite">
                    {submitError ? <span className="text-rdt">{submitError}</span>
                        : errorCount > 0 && <span className="text-rdt">{t("form.errorsToFix", {count: errorCount})}</span>}
                </span>
                {draftSavedAt && (
                    <span className="text-xs text-mu">
                        {t("form.draftSaved", {time: draftSavedAt.toLocaleTimeString(i18n?.language || undefined, {hour: "2-digit", minute: "2-digit"})})}
                    </span>
                )}
                <Button size="lg" onClick={onSubmit} loading={submitting} disabled={preview}
                        className="h-12 w-full rounded-xl sm:h-11 sm:w-auto sm:px-[22px]">
                    {preview ? t("form.previewSubmitDisabled") : submitting ? t("form.submitting") : t("form.submit")}
                </Button>
            </div>
        </div>
    );
}

/**
 * "Заявка отправлена" (ФТ-3.3.9, #114): form and server, the review time the author
 * gave, the submission's short number and time; on a phone "Вернуться в Discord".
 */
export function SuccessCard({title, guildName, guildId, reviewTime, receipt}: {
    title: string;
    guildName?: string | null;
    guildId?: string | null;
    reviewTime?: string | null;
    receipt?: { id: string; number?: number | null; createdAt: string } | null;
}) {
    const {t, i18n} = useTranslation();
    const when = receipt?.createdAt
        ? new Intl.DateTimeFormat(i18n?.language || "ru", {dateStyle: "short", timeStyle: "short"}).format(new Date(receipt.createdAt))
        : null;
    return (
        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
            <div className="flex w-full max-w-[520px] flex-col items-center gap-3.5 rounded-[20px] border border-bd bg-sf p-6 text-center sm:p-10">
                <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-gnb text-gnt" aria-hidden="true"><FiCheck size={28}/></span>
                <h1 className="m-0 text-[26px] font-bold">{t("form.success.title")}</h1>
                <p className="m-0 text-[15px] leading-relaxed text-mu">
                    {[`«${title}»`, guildName].filter(Boolean).join(" · ")}. {reviewTime ? t("form.success.textWithTime", {time: reviewTime}) : t("form.success.text")}
                </p>
                {receipt && (
                    <span className="rounded-[10px] bg-s2 px-3 py-1.5 font-mono text-xs text-mu">
                        № {receipt.number ?? receipt.id.slice(0, 8)}{when && <> · {when}</>}
                    </span>
                )}
                <div className="flex w-full flex-col gap-2.5 pt-1.5 sm:w-auto sm:flex-row">
                    <Link to="/me/submissions" className="inline-flex h-11 items-center justify-center rounded-xl bg-pr px-[18px] text-[15px] font-semibold text-white no-underline hover:bg-prh">
                        {t("shell.mySubmissions")}
                    </Link>
                    <Link to="/" className={cx("h-11 items-center justify-center rounded-xl border border-bd px-[18px] text-[15px] font-medium text-tx no-underline hover:bg-s2",
                        guildId ? "hidden sm:inline-flex" : "inline-flex")}>
                        {t("form.success.home")}
                    </Link>
                    {guildId && (
                        <a href={`https://discord.com/channels/${guildId}`}
                           className="inline-flex h-11 items-center justify-center rounded-xl border border-bd px-[18px] text-[15px] font-medium text-tx no-underline hover:bg-s2 sm:hidden">
                            {t("form.success.backToDiscord")}
                        </a>
                    )}
                </div>
            </div>
        </main>
    );
}

