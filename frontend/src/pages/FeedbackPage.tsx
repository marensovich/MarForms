import {useId, useState} from "react";
import {Link, useSearchParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import type {IconType} from "react-icons";
import {FiAlertTriangle, FiCheckCircle, FiMessageSquare, FiTool, FiZap} from "react-icons/fi";
import {FEEDBACK_QUESTIONS, type FeedbackType, sendFeedback} from "../api/feedback";
import {describeApiError} from "../api/errors";
import UserMenu from "../shell/UserMenu";
import {Button, cx} from "../ui";

// Not in the mockups: the owner's answer of 2026-10-19 — a page of its own for
// feedback about MarForms, each kind with its own questions. Built like «Мои заявки».

const KINDS: { type: FeedbackType; icon: IconType; tone: string }[] = [
    {type: "BUG", icon: FiTool, tone: "bg-rdb text-rdt"},
    {type: "IDEA", icon: FiZap, tone: "bg-gnb text-gnt"},
    {type: "PROBLEM", icon: FiAlertTriangle, tone: "bg-amb text-amt"},
    {type: "OTHER", icon: FiMessageSquare, tone: "bg-prs text-prt"},
];

function Mark() {
    return (
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-pr text-white" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M7 7h10M7 12h10M7 17h5"/>
            </svg>
        </span>
    );
}

/** The questions of one kind, and sending them. */
function FeedbackForm({type, from, onSent}: { type: FeedbackType; from: string | null; onSent: (delivered: boolean) => void }) {
    const {t} = useTranslation();
    const baseId = useId();
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [tried, setTried] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const questions = FEEDBACK_QUESTIONS[type];
    const missing = questions.filter(q => q.required && !(answers[q.id] ?? "").trim()).map(q => q.id);

    const submit = async () => {
        setTried(true);
        if (missing.length) return;
        setBusy(true);
        setError(null);
        try {
            const sent = await sendFeedback(type, answers, from ?? undefined);
            onSent(sent.delivered);
        } catch (e) {
            setError(describeApiError(e, t("feedback.error")));
            setBusy(false);
        }
    };

    return (
        <form noValidate onSubmit={e => {
            e.preventDefault();
            void submit();
        }} className="flex flex-col gap-4 rounded-2xl border border-bd bg-sf p-5 md:p-6">
            {questions.map(q => {
                const id = `${baseId}-${q.id}`;
                const value = answers[q.id] ?? "";
                const invalid = tried && missing.includes(q.id);
                const set = (v: string) => setAnswers(a => ({...a, [q.id]: v}));
                return (
                    <div key={q.id} className="flex flex-col gap-1.5">
                        {q.kind === "choice" ? (
                            <span id={id} className="text-sm font-semibold">
                                {t(`feedback.q.${type}.${q.id}`)}
                                {q.required && <span className="text-rdt" aria-hidden="true"> *</span>}
                            </span>
                        ) : (
                            <label htmlFor={id} className="text-sm font-semibold">
                                {t(`feedback.q.${type}.${q.id}`)}
                                {q.required && <span className="text-rdt" aria-hidden="true"> *</span>}
                            </label>
                        )}
                        {t(`feedback.hint.${type}.${q.id}`, {defaultValue: ""}) && (
                            <span className="text-xs text-mu">{t(`feedback.hint.${type}.${q.id}`)}</span>
                        )}
                        {q.kind === "choice" ? (
                            <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
                                {q.options!.map(o => (
                                    <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => set(o)}
                                            className={cx("rounded-full border px-3 py-1.5 text-[13px] font-medium",
                                                value === o ? "border-pr bg-prs text-prt" : "border-bd text-tx hover:bg-s2")}>
                                        {t(`feedback.option.${q.id}.${o}`)}
                                    </button>
                                ))}
                            </div>
                        ) : q.kind === "text" ? (
                            <textarea id={id} value={value} maxLength={q.max} rows={4} aria-invalid={invalid || undefined}
                                      onChange={e => set(e.target.value)}
                                      className={cx("w-full resize-y rounded-xl border bg-sf px-3.5 py-2.5 text-sm text-tx outline-none focus:border-pr",
                                          invalid ? "border-rdt" : "border-bd")}/>
                        ) : (
                            <input id={id} value={value} maxLength={q.max} aria-invalid={invalid || undefined}
                                   onChange={e => set(e.target.value)}
                                   className={cx("h-11 w-full rounded-xl border bg-sf px-3.5 text-sm text-tx outline-none focus:border-pr",
                                       invalid ? "border-rdt" : "border-bd")}/>
                        )}
                        {invalid && <span className="text-xs text-rdt">{t("feedback.required")}</span>}
                    </div>
                );
            })}
            {error && <p role="alert" className="m-0 rounded-[10px] bg-rdb px-3 py-2 text-[13px] text-rdt">{error}</p>}
            <div className="flex justify-end">
                <Button type="submit" loading={busy}>{t("feedback.send")}</Button>
            </div>
        </form>
    );
}

/**
 * «Обратная связь»: what it is about — a bug, an idea, a potential problem or
 * anything else — and that kind's questions. It goes to the platform's team.
 */
export default function FeedbackPage() {
    const {t} = useTranslation();
    const [params, setParams] = useSearchParams();
    const picked = KINDS.find(k => k.type === params.get("type"))?.type ?? null;
    const [sent, setSent] = useState<{ delivered: boolean } | null>(null);

    const pick = (type: FeedbackType) => {
        setSent(null);
        const from = params.get("from");
        setParams(from ? {type, from} : {type}, {replace: true});
    };

    return (
        <div className="flex min-h-screen flex-col bg-bg text-tx">
            <header className="border-b border-bd bg-sf">
                <div className="mx-auto flex h-[60px] max-w-[1280px] items-center gap-4 px-4 md:px-8">
                    <Link to="/" className="flex items-center gap-2.5 text-base font-bold text-tx">
                        <Mark/>MarForms
                    </Link>
                    <span className="flex-1"/>
                    <Link to="/feedback" aria-current="page" className="hidden text-sm font-semibold text-prt md:inline">
                        {t("feedback.title")}
                    </Link>
                    <UserMenu variant="topbar"/>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 pb-16 pt-5 md:px-8 md:pt-9">
                <div className="flex flex-col gap-1.5">
                    <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em] md:text-[28px]">{t("feedback.title")}</h1>
                    <p className="m-0 text-[15px] text-mu">{t("feedback.subtitle")}</p>
                </div>

                <div role="radiogroup" aria-label={t("feedback.kind")} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {KINDS.map(k => (
                        <button key={k.type} type="button" role="radio" aria-checked={picked === k.type} onClick={() => pick(k.type)}
                                className={cx("flex items-start gap-3 rounded-2xl border p-4 text-left",
                                    picked === k.type ? "border-pr bg-prs" : "border-bd bg-sf hover:bg-s2")}>
                            <span className={cx("grid h-9 w-9 flex-none place-items-center rounded-[10px]", k.tone)}>
                                <k.icon size={17} aria-hidden="true"/>
                            </span>
                            <span className="flex flex-col gap-0.5">
                                <span className="text-sm font-semibold">{t(`feedback.kinds.${k.type}.title`)}</span>
                                <span className="text-[13px] text-mu">{t(`feedback.kinds.${k.type}.text`)}</span>
                            </span>
                        </button>
                    ))}
                </div>

                {sent ? (
                    <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-bd bg-sf p-8 text-center">
                        <FiCheckCircle size={32} aria-hidden="true" className="text-gnt"/>
                        <h2 className="m-0 text-lg font-bold">{t("feedback.thanks")}</h2>
                        <p className="m-0 text-sm text-mu">{t("feedback.thanksText")}</p>
                        <Button variant="secondary" onClick={() => setSent(null)}>{t("feedback.another")}</Button>
                    </div>
                ) : picked && <FeedbackForm key={picked} type={picked} from={params.get("from")} onSent={delivered => setSent({delivered})}/>}
            </main>
        </div>
    );
}
