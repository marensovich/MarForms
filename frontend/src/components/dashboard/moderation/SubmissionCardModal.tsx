import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiCheck, FiCornerUpLeft, FiDownload, FiFile, FiStar, FiX} from "react-icons/fi";
import {
    decideSubmission,
    type DecisionStatus,
    downloadSubmissionFile,
    getSubmissionDetail,
    type ModerationSubmission,
    type SubmissionDetail,
    type SubmissionFile,
} from "../../../api/moderation";
import {ApiError} from "../../../api/client";
import {describeApiError} from "../../../api/errors";
import type {FormField} from "../../../types/forms";
import {Modal, TabSkeleton} from "../shared";
import {SubmissionStatusBadge} from "./SubmissionStatusBadge";
import {formatBytes} from "../../form/fields/fileRules";

function formatAnswer(field: FormField | undefined, value: unknown, t: (k: string) => string): string {
    if (value === null || value === undefined || value === "") return "—";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
    if (typeof value === "boolean") return value ? t("moderation.card.yes") : t("moderation.card.no");
    if (field?.type === "DATETIME" && typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? value : d.toLocaleString();
    }
    return String(value);
}

function Rating({value, max}: { value: number; max: number }) {
    return (
        <span className="inline-flex items-center gap-0.5">
            {[...Array(max)].map((_, i) => (
                <FiStar key={i} size={14}
                        className={i < value ? "fill-[#C99A3E] text-[#C99A3E]" : "text-[#D4D4D9]"}/>
            ))}
            <span className="ml-1.5 text-xs text-[#6B6B76]">{value}/{max}</span>
        </span>
    );
}

function Attachment({file}: { file: SubmissionFile | undefined }) {
    const {t} = useTranslation();
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    if (!file) return <p className="text-sm text-[#8B8B96]">—</p>;
    return (
        <div className="flex items-center gap-3">
            <FiFile size={15} className="flex-shrink-0 text-[#6B6B76]"/>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[#1E1E24]">{file.name}</p>
                <p className="text-xs text-[#8B8B96]">{formatBytes(file.size)}</p>
            </div>
            <button
                type="button"
                disabled={busy}
                onClick={() => {
                    setBusy(true);
                    setFailed(false);
                    downloadSubmissionFile(file).catch(() => setFailed(true)).finally(() => setBusy(false));
                }}
                className="flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-[#55555F] transition-colors hover:text-[#1E1E24] disabled:opacity-50"
            >
                <FiDownload size={12}/>
                {failed ? t("moderation.card.downloadFailed") : t("moderation.card.download")}
            </button>
        </div>
    );
}

function roleColor(color: number): string | undefined {
    if (!color || color === 0x1FFFFFFF) return undefined;
    return `#${color.toString(16).padStart(6, "0")}`;
}

function Avatar({url, name}: { url: string | null; name: string }) {
    const [broken, setBroken] = useState(false);
    if (url && !broken) {
        return <img src={url} alt="" onError={() => setBroken(true)}
                    className="h-11 w-11 flex-shrink-0 rounded-full object-cover"/>;
    }
    return (
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#3730A3] text-sm font-bold text-white">
            {(name[0] ?? "?").toUpperCase()}
        </div>
    );
}

const DECISIONS: { status: DecisionStatus; icon: typeof FiCheck; cls: string }[] = [
    {status: "APPROVED", icon: FiCheck, cls: "bg-[#3F6B4A] hover:bg-[#335A3D] text-white"},
    {status: "NEEDS_REVISION", icon: FiCornerUpLeft, cls: "bg-[#C99A3E] hover:bg-[#B0862F] text-white"},
    {status: "REJECTED", icon: FiX, cls: "bg-[#B54B45] hover:bg-[#9C3F3A] text-white"},
];

/**
 * The moderation card (task #55): answers labelled by the form schema, the
 * author's guild profile and Approve / Request revision / Reject with an
 * optional comment. Reports the updated submission so the list can patch
 * its row in place.
 */
export default function SubmissionCardModal({submissionId, onClose, onDecided}: {
    submissionId: string;
    onClose: () => void;
    onDecided: (updated: ModerationSubmission) => void;
}) {
    const {t} = useTranslation();
    const [detail, setDetail] = useState<SubmissionDetail | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [comment, setComment] = useState("");
    const [busy, setBusy] = useState<DecisionStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

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

    const decide = async (status: DecisionStatus) => {
        if (!detail || busy) return;
        setBusy(status);
        setError(null);
        try {
            const updated = await decideSubmission(detail.submission.id, status, comment);
            setDetail({...detail, submission: {...detail.submission, ...updated}});
            setComment("");
            onDecided(updated);
        } catch (e) {
            if (e instanceof ApiError && e.status === 409) {
                // Another moderator decided first: show what is there now.
                setError(t("moderation.card.conflict"));
                setReloadKey(k => k + 1);
            } else {
                setError(describeApiError(e, t("moderation.card.decideError")));
            }
        } finally {
            setBusy(null);
        }
    };

    const submission = detail?.submission;
    const author = detail?.author;
    const fieldsById = new Map((detail?.schema.fields ?? []).map(f => [f.id, f]));
    // Answers in form order, then any answers for fields since removed.
    const orderedFields = detail?.schema.fields ?? [];
    const orphanKeys = submission
        ? Object.keys(submission.answers).filter(k => !fieldsById.has(k))
        : [];

    return (
        <Modal
            title={submission?.formTitle ?? detail?.schema.title ?? t("moderation.card.title")}
            subtitle={submission ? new Date(submission.createdAt).toLocaleString() : undefined}
            onClose={onClose}
            width="max-w-2xl"
        >
            {loadError ? (
                <p className="text-sm text-[#8B4A46]">{loadError}</p>
            ) : !detail || !submission ? (
                <TabSkeleton rows={4}/>
            ) : (
                <div className="flex max-h-[72vh] flex-col gap-4 overflow-y-auto pr-1">
                    {/* Author */}
                    <div className="flex items-start gap-3 rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] p-4">
                        {author ? (
                            <>
                                <Avatar url={author.avatarUrl} name={author.username ?? author.discordId}/>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-semibold text-[#1E1E24]">
                                            {author.username ?? t("moderation.unknownUser")}
                                        </p>
                                        <SubmissionStatusBadge status={submission.status}/>
                                    </div>
                                    <p className="font-mono text-[11px] text-[#8B8B96]">{author.discordId}</p>
                                    <p className="mt-1 text-xs text-[#6B6B76]">
                                        {t("moderation.card.submissionCount", {count: author.submissionCount})}
                                    </p>
                                    {author.discordRoles.length > 0 ? (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {author.discordRoles.map(r => {
                                                const color = roleColor(r.color);
                                                return (
                                                    <span key={r.id}
                                                          className="inline-flex items-center gap-1 rounded-full border border-[#E4E4E7] bg-white px-2 py-0.5 text-[11px] text-[#55555F]">
                                                        <span className="h-2 w-2 rounded-full"
                                                              style={{background: color ?? "#9A9AA4"}}/>
                                                        {r.name ?? r.id}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-[11px] text-[#8B8B96]">{t("moderation.card.noRoles")}</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-[#6B6B76]">{t("moderation.card.anonymous")}</p>
                                <SubmissionStatusBadge status={submission.status}/>
                            </div>
                        )}
                    </div>

                    {/* Answers */}
                    <div className="flex flex-col gap-2">
                        {orderedFields.map(field => {
                            if (field.type === "SECTION_BREAK") {
                                return (
                                    <p key={field.id}
                                       className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#8B8B96]">
                                        {field.label}
                                    </p>
                                );
                            }
                            const value = submission.answers[field.id];
                            return (
                                <div key={field.id} className="rounded-lg border border-[#E4E4E7] p-3">
                                    <p className="mb-1 text-xs font-medium text-[#6B6B76]">{field.label}</p>
                                    {field.type === "RATING" && typeof value === "number" ? (
                                        <Rating value={value} max={field.max ?? 5}/>
                                    ) : field.type === "FILE_UPLOAD" ? (
                                        <Attachment file={detail.files?.find(fl => fl.fieldId === field.id && fl.id === value)}/>
                                    ) : (
                                        <p className="whitespace-pre-wrap break-words text-sm text-[#1E1E24]">
                                            {formatAnswer(field, value, t)}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                        {orphanKeys.map(key => (
                            <div key={key} className="rounded-lg border border-dashed border-[#E4E4E7] p-3">
                                <p className="mb-1 text-xs font-medium text-[#8B8B96]">
                                    {key} · {t("moderation.card.removedField")}
                                </p>
                                <p className="whitespace-pre-wrap break-words text-sm text-[#55555F]">
                                    {formatAnswer(undefined, submission.answers[key], t)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Previous decision */}
                    {submission.decidedAt && (
                        <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFB] px-3 py-2 text-xs text-[#55555F]">
                            {t("moderation.card.lastDecision", {
                                date: new Date(submission.decidedAt).toLocaleString(),
                                moderator: submission.moderatorDiscordId ?? "—",
                            })}
                            {submission.moderatorComment && (
                                <p className="mt-1 whitespace-pre-wrap text-[#1E1E24]">«{submission.moderatorComment}»</p>
                            )}
                        </div>
                    )}

                    {/* Decision */}
                    <div className="border-t border-[#E4E4E7] pt-4">
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            maxLength={2000}
                            rows={2}
                            placeholder={t("moderation.card.commentPlaceholder")}
                            className="w-full resize-y rounded-lg border border-[#E4E4E7] px-3 py-2 text-sm text-[#1E1E24] outline-none placeholder:text-[#C7C7CE] focus:border-[#3730A3]"
                        />
                        {error && (
                            <p className="mt-2 rounded-lg border border-[#EAD4D3] bg-[#F7EEEE] px-3 py-2 text-xs text-[#8B4A46]">
                                {error}
                            </p>
                        )}
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                            {DECISIONS.map(({status, icon: Icon, cls}) => (
                                <button
                                    key={status}
                                    onClick={() => decide(status)}
                                    disabled={busy !== null || submission.status === status && !comment.trim()}
                                    className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
                                >
                                    <Icon size={14}/>
                                    {busy === status ? t("common.saving") : t(`moderation.decide.${status}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
