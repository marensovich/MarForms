import {useEffect, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import {FiCheck, FiChevronLeft, FiChevronRight, FiFile, FiImage, FiRotateCcw, FiStar, FiX} from "react-icons/fi";
import {
    decideSubmission,
    type DecisionStatus,
    downloadSubmissionFile,
    getSubmissionDetail,
    type ModerationSubmission,
    type SubmissionDetail,
    type SubmissionEvent,
    type SubmissionFile,
} from "../../../api/moderation";
import {ApiError} from "../../../api/client";
import {describeApiError} from "../../../api/errors";
import {Avatar, cx, Skeleton, Spinner, useFocusTrap, useToast} from "../../../ui";
import {SubmissionStatusBadge} from "./SubmissionStatusBadge";
import {formatBytes} from "../../form/fields/fileRules";
import {formatAnswer} from "../../submission/formatAnswer";

// Docs: docs/design/mockups/WsSubmissions.dc.html (the card), DarkModeration, R1024Moderation; ТЗ 4.5.3–4.5.6.

/** Decisions that need a comment (ТЗ ФТ-4.5.4). */
const NEEDS_COMMENT: DecisionStatus[] = ["REJECTED", "NEEDS_REVISION"];

const CHOICE: Record<DecisionStatus, { on: string; off: string }> = {
    APPROVED: {on: "border-[1.5px] border-gnt bg-gnb text-gnt", off: "text-gnt"},
    REJECTED: {on: "border-[1.5px] border-rdt bg-rdb text-rdt", off: "text-rdt"},
    NEEDS_REVISION: {on: "border-[1.5px] border-prt bg-prs text-prt", off: "text-tx"},
};

const when = (iso: string, lang: string) =>
    new Date(iso).toLocaleString(lang, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});

function roleColor(color: number): string {
    return !color || color === 0x1FFFFFFF ? "rgb(var(--mu))" : `#${color.toString(16).padStart(6, "0")}`;
}

function Rating({value, max}: { value: number; max: number }) {
    return (
        <span className="inline-flex items-center gap-0.5">
            {[...Array(max)].map((_, i) => (
                <FiStar key={i} size={14} aria-hidden="true" className={i < value ? "fill-wr text-amt" : "text-mu"}/>
            ))}
            <span className="ml-1.5 text-xs text-mu">{value}/{max}</span>
        </span>
    );
}

/** A file chip: name and size; a click downloads it. */
function Attachment({file}: { file: SubmissionFile }) {
    const {t} = useTranslation();
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const Icon = file.contentType?.startsWith("image/") ? FiImage : FiFile;
    return (
        <button type="button" disabled={busy} title={t("moderation.card.download")}
                onClick={() => {
                    setBusy(true);
                    setFailed(false);
                    downloadSubmissionFile(file).catch(() => setFailed(true)).finally(() => setBusy(false));
                }}
                className={cx("flex h-10 items-center gap-2 rounded-[10px] border px-3 text-[13px] text-tx hover:bg-s2 disabled:opacity-60",
                    failed ? "border-rdt" : "border-bd")}>
            {busy ? <Spinner/> : <Icon size={16} aria-hidden="true" className="text-mu"/>}
            {file.name}
            <span className="text-mu">{failed ? t("moderation.card.downloadFailed") : formatBytes(file.size)}</span>
        </button>
    );
}

const DOT: Record<string, string> = {
    SUBMITTED: "bg-mu",
    RESUBMITTED: "bg-amt",
    REOPENED: "bg-amt",
    APPROVED: "bg-gnt",
    REJECTED: "bg-rdt",
    NEEDS_REVISION: "bg-prt",
};

/** «<b>Анна К.</b> запросила доработку · 14 окт, 20:10 · «comment»» — newest first, as in the mockup. */
function History({events}: { events: SubmissionEvent[] }) {
    const {t, i18n} = useTranslation();
    if (events.length === 0) return null;
    return (
        <section aria-label={t("submissionHistory.title")} className="flex flex-col gap-2.5 border-t border-bd pt-1">
            <span className="pt-3.5 text-xs font-semibold text-mu">{t("submissionHistory.title")}</span>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                {[...events].reverse().map((e, i) => {
                    const kind = e.type === "DECIDED" ? e.to : e.type;
                    return (
                        <li key={i} className="flex gap-2.5">
                            <span className={cx("mt-1 h-2.5 w-2.5 flex-none rounded-full", DOT[kind])} aria-hidden="true"/>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[13px]">
                                    {e.actorName && <b>{e.actorName} </b>}{t(`moderation.card.event.${kind}`)}
                                </span>
                                <span className="text-xs text-mu">{when(e.at, i18n.language)}</span>
                                {e.comment && <span className="whitespace-pre-wrap text-[13px] italic text-mu">«{e.comment}»</span>}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

/**
 * The submission card (ТЗ 4.5.3–4.5.6, WsSubmissions.dc.html): answers by
 * section with the files, the author with their current Discord roles, the
 * decision — Принять, or Отклонить / На доработку with a comment — and the
 * history. The owner may send a final decision back to pending. A decision
 * someone else made first (409) is named and the card reloads. Reports the
 * updated submission so the queue can patch its row in place.
 */
export default function SubmissionCardModal({submissionId, onClose, onDecided, canReopen = false, onPrev, onNext}: {
    submissionId: string;
    onClose: () => void;
    onDecided: (updated: ModerationSubmission) => void;
    /** The server's owner (or platform staff): may send a decision back to pending. */
    canReopen?: boolean;
    /** The neighbouring submissions of the queue's page; absent at its ends. */
    onPrev?: () => void;
    onNext?: () => void;
}) {
    const {t, i18n} = useTranslation();
    const toast = useToast();
    const ref = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const commentId = useId();
    useFocusTrap(ref, true, onClose);
    const [detail, setDetail] = useState<SubmissionDetail | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [choice, setChoice] = useState<DecisionStatus | null>(null);
    const [comment, setComment] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    // Moving to another submission starts the card afresh.
    const [shownId, setShownId] = useState(submissionId);
    if (shownId !== submissionId) {
        setShownId(submissionId);
        setDetail(null);
        setChoice(null);
        setComment("");
        setError(null);
    }

    useEffect(() => {
        let cancelled = false;
        getSubmissionDetail(submissionId)
            .then(d => {
                if (cancelled) return;
                setDetail(d);
                setLoadError(null);
            })
            .catch(e => {
                if (!cancelled) setLoadError(describeApiError(e, t("moderation.card.loadError")));
            });
        return () => {
            cancelled = true;
        };
    }, [submissionId, reloadKey, t]);

    const decide = async (status: DecisionStatus | "PENDING") => {
        if (!detail || busy) return;
        if (status !== "PENDING" && NEEDS_COMMENT.includes(status) && !comment.trim()) {
            setError(t("moderation.card.commentRequired"));
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const updated = await decideSubmission(detail.submission.id, status, comment, detail.submission.status);
            setComment("");
            setChoice(null);
            onDecided(updated);
            // No «Отменить»: the author is told at once (ТЗ ФТ-4.5.5).
            toast({tone: "success", text: t(status === "PENDING" ? "moderation.card.reopened" : "moderation.card.decided",
                    {status: t(`moderation.status.${status}`)})});
            setReloadKey(k => k + 1);
        } catch (e) {
            if (e instanceof ApiError && e.status === 409) {
                // Another moderator decided first: say who and when, and show what is there now.
                const body = e.body as { decidedBy?: string | null; decidedAt?: string | null } | null;
                setError(body?.decidedBy
                    ? t("moderation.card.conflictBy", {
                        name: body.decidedBy,
                        date: body.decidedAt ? when(body.decidedAt, i18n.language) : "",
                    })
                    : t("moderation.card.conflict"));
                setChoice(null);
                setReloadKey(k => k + 1);
            } else {
                setError(describeApiError(e, t("moderation.card.decideError")));
            }
        } finally {
            setBusy(false);
        }
    };

    const submission = detail?.submission;
    const pending = submission?.status === "PENDING";
    const reopenable = canReopen && (submission?.status === "APPROVED" || submission?.status === "REJECTED");
    const resubmitted = detail?.history.some(e => e.type === "RESUBMITTED") ?? false;
    const author = detail?.author;
    const fields = detail?.schema.fields ?? [];
    const known = new Set(fields.map(f => f.id));
    const orphanKeys = submission ? Object.keys(submission.answers).filter(k => !known.has(k)) : [];
    const title = submission?.number != null
        ? t("moderation.card.titleNumber", {number: submission.number})
        : t("moderation.card.title");
    const navBtn = "grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-bd bg-sf text-tx hover:bg-s2 disabled:text-mu disabled:opacity-50 disabled:hover:bg-sf";

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ov px-6 py-14"
             onMouseDown={e => e.target === e.currentTarget && onClose()}>
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
                 className="flex w-full max-w-[1040px] flex-col overflow-hidden rounded-[20px] border border-bd bg-sf text-tx shadow-modal outline-none">
                <div className="flex items-center gap-3 border-b border-bd px-6 py-[18px]">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h2 id={titleId} className="m-0 text-xl font-bold">{title}</h2>
                            {submission && <SubmissionStatusBadge status={submission.status}/>}
                        </div>
                        {submission && (
                            <span className="text-[13px] text-mu">
                                {t("moderation.card.subtitle", {
                                    form: submission.formTitle ?? detail?.schema.title ?? "—",
                                    date: when(submission.createdAt, i18n.language),
                                })}
                                {resubmitted && ` ${t("moderation.card.afterRevision")}`}
                            </span>
                        )}
                    </div>
                    <button type="button" aria-label={t("moderation.card.prev")} onClick={onPrev} disabled={!onPrev} className={navBtn}>
                        <FiChevronLeft size={16} aria-hidden="true"/>
                    </button>
                    <button type="button" aria-label={t("moderation.card.next")} onClick={onNext} disabled={!onNext} className={navBtn}>
                        <FiChevronRight size={16} aria-hidden="true"/>
                    </button>
                    <button type="button" aria-label={t("ui.close")} onClick={onClose}
                            className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-s2 text-tx hover:bg-bd">
                        <FiX size={16} aria-hidden="true"/>
                    </button>
                </div>

                {loadError ? (
                    <p role="alert" className="m-0 p-6 text-sm text-rdt">{loadError}</p>
                ) : !detail || !submission ? (
                    <div className="flex flex-col gap-3 p-6" aria-busy="true">
                        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg"/>)}
                    </div>
                ) : (
                    <div className="flex flex-wrap">
                        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-4 border-r border-bd px-6 py-5">
                            {fields.map(field => {
                                if (field.type === "SECTION_BREAK") {
                                    return <h3 key={field.id} className="m-0 mt-1 text-[15px] font-bold">{field.label}</h3>;
                                }
                                const value = submission.answers[field.id];
                                const files = field.type === "FILE_UPLOAD"
                                    ? (detail.files ?? []).filter(f => f.fieldId === field.id) : [];
                                return (
                                    <div key={field.id} className="flex flex-col gap-1">
                                        <span className="text-xs font-semibold text-mu">{field.label}</span>
                                        {field.type === "RATING" && typeof value === "number" ? (
                                            <Rating value={value} max={field.max ?? 5}/>
                                        ) : field.type === "FILE_UPLOAD" ? (
                                            files.length ? (
                                                <div className="mt-1 flex flex-wrap gap-2">
                                                    {files.map(f => <Attachment key={f.id} file={f}/>)}
                                                </div>
                                            ) : <span className="text-[15px] text-mu">—</span>
                                        ) : (
                                            <span className="whitespace-pre-wrap break-words text-[15px] leading-normal">
                                                {formatAnswer(field, value, t)}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                            {orphanKeys.map(key => (
                                <div key={key} className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-mu">{key} · {t("moderation.card.removedField")}</span>
                                    <span className="whitespace-pre-wrap break-words text-[15px] text-mu">
                                        {formatAnswer(undefined, submission.answers[key], t)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-[18px] bg-s2 px-6 py-5">
                            {author ? (
                                <>
                                    <div className="flex items-center gap-3">
                                        <Avatar name={author.username ?? author.discordId} src={author.avatarUrl} size={44}/>
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <span className="truncate font-semibold">{author.username ?? t("moderation.unknownUser")}</span>
                                            <span className="font-mono text-[11px] text-mu">ID {author.discordId}</span>
                                            <span className="text-xs text-mu">
                                                {t("moderation.card.submissionCount", {count: author.submissionCount})}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold text-mu">{t("moderation.card.roles")}</span>
                                        {author.discordRoles.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {author.discordRoles.map(r => (
                                                    <span key={r.id}
                                                          className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-bd bg-sf px-[9px] text-xs font-medium">
                                                        <span className="h-2 w-2 rounded-full" style={{background: roleColor(r.color)}} aria-hidden="true"/>
                                                        {r.name ?? r.id}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : <span className="text-xs text-mu">{t("moderation.card.noRoles")}</span>}
                                    </div>
                                </>
                            ) : (
                                <p className="m-0 text-sm text-mu">{t("moderation.card.anonymous")}</p>
                            )}

                            {pending && (
                                <div className="flex flex-col gap-2.5 pt-1">
                                    <span className="text-xs font-semibold text-mu">{t("moderation.card.decision")}</span>
                                    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={t("moderation.card.decision")}>
                                        {(["APPROVED", "REJECTED", "NEEDS_REVISION"] as const).map(s => (
                                            <button key={s} type="button" aria-pressed={choice === s} disabled={busy}
                                                    onClick={() => {
                                                        setChoice(s);
                                                        setError(null);
                                                    }}
                                                    className={cx("h-10 rounded-[10px] text-[13px] font-semibold disabled:opacity-60",
                                                        choice === s ? CHOICE[s].on : cx("border border-bd bg-sf hover:bg-bg", CHOICE[s].off))}>
                                                {t(`moderation.decide.${s}`)}
                                            </button>
                                        ))}
                                    </div>
                                    <label htmlFor={commentId} className="sr-only">{t("moderation.card.comment")}</label>
                                    <textarea id={commentId} value={comment} onChange={e => setComment(e.target.value)}
                                              maxLength={2000} rows={3} disabled={busy}
                                              placeholder={t(choice && NEEDS_COMMENT.includes(choice)
                                                  ? "moderation.card.commentRequiredPlaceholder" : "moderation.card.commentPlaceholder")}
                                              className="resize-y rounded-xl border border-bd bg-sf px-3 py-2.5 text-sm leading-[1.45] text-tx outline-none placeholder:text-mu focus:border-pr"/>
                                    {error && <p role="alert" className="m-0 rounded-[10px] bg-rdb px-3 py-2 text-[13px] text-rdt">{error}</p>}
                                    <button type="button" onClick={() => choice && decide(choice)} disabled={!choice || busy}
                                            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-pr text-sm font-semibold text-white hover:bg-prh disabled:opacity-50">
                                        {busy ? <Spinner className="h-4 w-4"/> : <FiCheck size={16} aria-hidden="true"/>}
                                        {t("moderation.card.confirm")}
                                    </button>
                                </div>
                            )}
                            {reopenable && (
                                <div className="flex flex-col gap-2.5 pt-1">
                                    <span className="text-xs font-semibold text-mu">{t("moderation.card.decision")}</span>
                                    <label htmlFor={commentId} className="sr-only">{t("moderation.card.comment")}</label>
                                    <textarea id={commentId} value={comment} onChange={e => setComment(e.target.value)}
                                              maxLength={2000} rows={2} disabled={busy} placeholder={t("moderation.card.reopenPlaceholder")}
                                              className="resize-y rounded-xl border border-bd bg-sf px-3 py-2.5 text-sm text-tx outline-none placeholder:text-mu focus:border-pr"/>
                                    {error && <p role="alert" className="m-0 rounded-[10px] bg-rdb px-3 py-2 text-[13px] text-rdt">{error}</p>}
                                    <button type="button" onClick={() => decide("PENDING")} disabled={busy}
                                            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-bd bg-sf text-sm font-semibold text-tx hover:bg-bg disabled:opacity-50">
                                        {busy ? <Spinner className="h-4 w-4"/> : <FiRotateCcw size={16} aria-hidden="true"/>}
                                        {t("moderation.decide.reopen")}
                                    </button>
                                </div>
                            )}
                            {submission.status === "NEEDS_REVISION" && (
                                <p className="m-0 text-[13px] text-mu">{t("moderation.card.awaitingRevision")}</p>
                            )}
                            {!pending && !reopenable && error && (
                                <p role="alert" className="m-0 rounded-[10px] bg-rdb px-3 py-2 text-[13px] text-rdt">{error}</p>
                            )}

                            <History events={detail.history ?? []}/>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
