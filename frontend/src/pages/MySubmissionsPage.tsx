import {useCallback, useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {FiChevronRight, FiFile, FiInbox} from "react-icons/fi";
import {
    getMySubmission,
    getMySubmissionCounts,
    getMySubmissions,
    type MySubmission,
    type MySubmissionDetail,
    type MySubmissionSegment,
    type SubmissionStatus,
} from "../api/moderation";
import {describeApiError} from "../api/errors";
import UserMenu from "../shell/UserMenu";
import {Avatar, Badge, Drawer, SegmentedControl, ServerIcon, Skeleton, type Tone} from "../ui";
import {formatAnswer} from "../components/submission/formatAnswer";
import SubmissionHistory from "../components/submission/SubmissionHistory";
import {formatBytes} from "../components/form/fields/fileRules";

// Docs: docs/design/mockups/MySubsDesktop.dc.html (desktop, panel), MySubmissions.dc.html (390 px),
// MySubsEmpty.dc.html; ТЗ 3.6.

const PAGE_SIZE = 20;

const STATUS_TONE: Record<SubmissionStatus, Tone> = {
    PENDING: "amber",
    APPROVED: "green",
    REJECTED: "red",
    NEEDS_REVISION: "primary",
    RECEIVED: "info",
};

function StatusBadge({status}: { status: SubmissionStatus }) {
    const {t} = useTranslation();
    return (
        <Badge tone={STATUS_TONE[status]}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"/>
            {t(`mySubmissions.status.${status}`)}
        </Badge>
    );
}

function Mark() {
    return (
        <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-pr text-white">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                 strokeLinecap="round" aria-hidden="true"><path d="M7 7h10M7 12h10M7 17h5"/></svg>
        </span>
    );
}

/**
 * A respondent's own submissions (ТЗ 3.6): segments with counters, a table on a
 * computer and cards on a phone, and a side panel with the answers and the
 * moderator's comment.
 */
export default function MySubmissionsPage() {
    const {t, i18n} = useTranslation();
    const [segment, setSegment] = useState<MySubmissionSegment>("all");
    const [counts, setCounts] = useState<Record<MySubmissionSegment, number> | null>(null);
    const [items, setItems] = useState<MySubmission[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);

    const date = useCallback((iso: string) => new Date(iso).toLocaleDateString(i18n.language,
        {day: "2-digit", month: "short", year: "numeric"}), [i18n.language]);

    useEffect(() => {
        getMySubmissionCounts().then(setCounts).catch(() => setCounts(null));
    }, []);

    useEffect(() => {
        let cancelled = false;
        getMySubmissions(page, PAGE_SIZE, segment)
            .then(r => {
                if (cancelled) return;
                setItems(prev => page === 0 ? r.content : [...prev, ...r.content]);
                setHasMore(r.page.number + 1 < r.page.totalPages);
                setError(null);
            })
            .catch(e => {
                if (!cancelled) setError(describeApiError(e, t("mySubmissions.loadError")));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [page, segment, t]);

    const changeSegment = (next: MySubmissionSegment) => {
        setSegment(next);
        setPage(0);
        setItems([]);
        setLoading(true);
    };

    const nothingAtAll = !loading && !error && counts?.all === 0;
    const segments = (["all", "pending", "decided"] as const).map(value => ({
        value, label: t(`mySubmissions.segment.${value}`), count: counts?.[value],
    }));

    return (
        <div className="flex min-h-screen flex-col bg-bg text-tx">
            <header className="border-b border-bd bg-sf">
                <div className="mx-auto flex h-[60px] max-w-[1280px] items-center gap-4 px-4 md:px-8">
                    <Link to="/" className="flex items-center gap-2.5 text-base font-bold text-tx">
                        <Mark/>MarForms
                    </Link>
                    <span className="flex-1"/>
                    <Link to="/me/submissions" aria-current="page" className="hidden text-sm font-semibold text-prt md:inline">
                        {t("mySubmissions.title")}
                    </Link>
                    <UserMenu variant="topbar"/>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 pb-16 pt-5 md:px-8 md:pt-9">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                        <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em] md:text-[28px]">{t("mySubmissions.title")}</h1>
                        <p className="m-0 hidden text-[15px] text-mu md:block">{t("mySubmissions.subtitle")}</p>
                    </div>
                    {!nothingAtAll && (
                        <div className="max-w-full overflow-x-auto">
                            <SegmentedControl options={segments} value={segment} onChange={changeSegment}
                                              ariaLabel={t("mySubmissions.segmentsLabel")}/>
                        </div>
                    )}
                </div>

                {error && (
                    <div role="alert" className="rounded-xl border border-rdb bg-rdb px-4 py-3 text-sm text-rdt">{error}</div>
                )}

                {nothingAtAll ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-bd bg-sf px-6 py-20 text-center">
                        <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-prs text-prt">
                            <FiInbox size={28} aria-hidden="true"/>
                        </span>
                        <h2 className="m-0 text-xl font-bold">{t("mySubmissions.emptyTitle")}</h2>
                        <p className="m-0 max-w-[420px] text-[15px] leading-normal text-mu">{t("mySubmissions.emptyText")}</p>
                        <Link to="/" className="flex h-11 items-center rounded-xl bg-pr px-[18px] text-[15px] font-semibold text-white hover:bg-prh">
                            {t("mySubmissions.openByLink")}
                        </Link>
                    </div>
                ) : loading && items.length === 0 ? (
                    <div className="flex flex-col gap-2" aria-busy="true">
                        {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl"/>)}
                    </div>
                ) : items.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-bd p-8 text-center text-sm text-mu">
                        {t("mySubmissions.emptySegment")}
                    </p>
                ) : (
                    <>
                        {/* Computer: table (MySubsDesktop). */}
                        <div className="hidden overflow-x-auto rounded-[14px] border border-bd bg-sf md:block">
                            <table className="w-full min-w-[760px] border-collapse text-sm">
                                <thead>
                                <tr className="text-left text-xs text-mu">
                                    <th className="border-b border-bd px-[18px] py-3 font-semibold">{t("mySubmissions.columns.form")}</th>
                                    <th className="border-b border-bd p-3 font-semibold">{t("mySubmissions.columns.server")}</th>
                                    <th className="border-b border-bd p-3 font-semibold">{t("mySubmissions.columns.sent")}</th>
                                    <th className="border-b border-bd p-3 font-semibold">{t("mySubmissions.columns.status")}</th>
                                    <th className="border-b border-bd p-3"><span className="sr-only">{t("mySubmissions.open")}</span></th>
                                </tr>
                                </thead>
                                <tbody>
                                {items.map(s => (
                                    <tr key={s.id} onClick={() => setOpenId(s.id)}
                                        className={openId === s.id ? "cursor-pointer bg-prs" : "cursor-pointer hover:bg-s2"}>
                                        <td className="border-b border-bd px-[18px] py-3.5 font-semibold">
                                            <button type="button" onClick={() => setOpenId(s.id)}
                                                    className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr">
                                                {s.formTitle ?? t("mySubmissions.untitled")}
                                            </button>
                                        </td>
                                        <td className="border-b border-bd px-3 py-3.5">
                                            <span className="inline-flex items-center gap-2">
                                                <ServerIcon name={s.guildName} src={s.guildIconUrl} size={22}/>
                                                {s.guildName ?? "—"}
                                            </span>
                                        </td>
                                        <td className="border-b border-bd px-3 py-3.5 text-mu">{date(s.createdAt)}</td>
                                        <td className="border-b border-bd px-3 py-3.5"><StatusBadge status={s.status}/></td>
                                        <td className="border-b border-bd py-3.5 pl-3 pr-[18px] text-right text-mu">
                                            <FiChevronRight size={16} aria-hidden="true" className="inline"/>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Phone: cards (MySubmissions). */}
                        <div className="flex flex-col gap-3 md:hidden">
                            {items.map(s => (
                                <article key={s.id} className="flex flex-col gap-2.5 rounded-2xl border border-bd bg-sf p-4">
                                    <div className="flex items-start justify-between gap-2.5">
                                        <h2 className="m-0 text-base leading-tight">
                                            <button type="button" onClick={() => setOpenId(s.id)} className="text-left font-bold">
                                                {s.formTitle ?? t("mySubmissions.untitled")}
                                            </button>
                                        </h2>
                                        <StatusBadge status={s.status}/>
                                    </div>
                                    <div className="flex items-center gap-2 text-[13px] text-mu">
                                        <ServerIcon name={s.guildName} src={s.guildIconUrl} size={20}/>
                                        {s.guildName ?? "—"} · {date(s.createdAt)}
                                    </div>
                                    {s.moderatorComment && (
                                        <div className="flex flex-col gap-1 rounded-xl bg-s2 px-3 py-2.5">
                                            <span className="text-xs font-semibold text-mu">
                                                {t("mySubmissions.comment")}{s.moderatorName && ` · ${s.moderatorName}`}
                                            </span>
                                            <span className="whitespace-pre-wrap text-sm leading-snug">{s.moderatorComment}</span>
                                        </div>
                                    )}
                                    {reviseLink(s) && (
                                        <Link to={reviseLink(s)!}
                                              className="flex h-11 items-center justify-center rounded-xl bg-pr text-sm font-semibold text-white hover:bg-prh">
                                            {t("mySubmissions.reviseShort")}
                                        </Link>
                                    )}
                                </article>
                            ))}
                        </div>

                        {hasMore && (
                            <button type="button" disabled={loading}
                                    onClick={() => {
                                        setLoading(true);
                                        setPage(p => p + 1);
                                    }}
                                    className="self-center rounded-xl border border-bd bg-sf px-4 py-2 text-sm font-medium text-tx hover:bg-s2 disabled:opacity-50">
                                {t("mySubmissions.more")}
                            </button>
                        )}
                    </>
                )}
            </main>

            <SubmissionPanel id={openId} onClose={() => setOpenId(null)}/>
        </div>
    );
}

/** «Доработать и отправить»: the form with the answers, for a submission sent back (ТЗ ФТ-3.6.5, #119). */
function reviseLink(s: MySubmission): string | null {
    return s.status === "NEEDS_REVISION" && s.formSlug ? `/f/${s.formSlug}?revise=${s.id}` : null;
}

/** The side panel of one submission (ТЗ ФТ-3.6.4). */
function SubmissionPanel({id, onClose}: { id: string | null; onClose: () => void }) {
    const {t, i18n} = useTranslation();
    const [detail, setDetail] = useState<MySubmissionDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        getMySubmission(id)
            .then(d => {
                if (!cancelled) {
                    setDetail(d);
                    setError(null);
                }
            })
            .catch(e => !cancelled && setError(describeApiError(e, t("mySubmissions.loadError"))));
        return () => {
            cancelled = true;
            setDetail(null);
        };
    }, [id, t]);

    const s = detail?.submission;
    const sent = s && new Date(s.createdAt).toLocaleString(i18n.language,
        {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});
    const fields = (detail?.schema?.fields ?? []).filter(f => f.type !== "SECTION_BREAK");

    const revise = s ? reviseLink(s) : null;
    return (
        <Drawer open={id !== null} onClose={onClose}
                footer={revise && (
                    <Link to={revise}
                          className="flex h-11 flex-1 items-center justify-center rounded-xl bg-pr text-[15px] font-semibold text-white hover:bg-prh">
                        {t("mySubmissions.revise")}
                    </Link>
                )}
                title={s ? s.formTitle ?? t("mySubmissions.untitled") : t("mySubmissions.loading")}
                subtitle={s && (
                    <span className="flex flex-col items-start gap-1.5">
                        <span>{s.guildName ?? "—"} · {t("mySubmissions.sentAt", {date: sent})}{s.number !== null && ` · № ${s.number}`}</span>
                        <StatusBadge status={s.status}/>
                    </span>
                )}>
            {error && <p role="alert" className="text-sm text-rdt">{error}</p>}
            {!detail && !error && <Skeleton className="h-40 w-full rounded-xl"/>}
            {s?.moderatorComment && (
                <div className="flex flex-col gap-1.5 rounded-xl bg-prs px-4 py-3.5">
                    <span className="flex items-center gap-2 text-[13px] font-bold text-prt">
                        {s.moderatorName && <Avatar name={s.moderatorName} size={22}/>}
                        {t("mySubmissions.comment")}{s.moderatorName && ` · ${s.moderatorName}`}
                    </span>
                    <span className="whitespace-pre-wrap text-sm leading-relaxed">{s.moderatorComment}</span>
                </div>
            )}
            {detail && (
                <dl className="m-0 flex flex-col gap-3.5">
                    {fields.map(field => {
                        const value = detail.answers[field.id];
                        const ids = Array.isArray(value) ? value : [value];
                        const files = field.type === "FILE_UPLOAD" ? detail.files.filter(f => ids.includes(f.id)) : [];
                        const empty = value === undefined || value === null || value === ""
                            || (Array.isArray(value) && value.length === 0);
                        return (
                            <div key={field.id} className="flex flex-col gap-1">
                                <dt className="text-xs text-mu">{field.label}</dt>
                                <dd className={empty ? "m-0 text-[15px] text-mu" : "m-0 whitespace-pre-wrap break-words text-[15px] leading-normal"}>
                                    {empty ? t("mySubmissions.notFilled")
                                        : files.length ? (
                                            <span className="flex flex-wrap gap-x-4 gap-y-1">
                                                {files.map(file => (
                                                    <span key={file.id} className="inline-flex items-center gap-1.5">
                                                        <FiFile size={14} aria-hidden="true"/>{file.name}
                                                        <span className="text-xs text-mu">{formatBytes(file.size)}</span>
                                                    </span>
                                                ))}
                                            </span>
                                        ) : formatAnswer(field, value, t)}
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            )}
            {detail && <SubmissionHistory events={detail.history ?? []}/>}
        </Drawer>
    );
}
