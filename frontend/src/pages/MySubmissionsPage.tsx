import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {FiArrowLeft, FiFileText, FiInbox, FiMessageSquare} from "react-icons/fi";
import {getMySubmissions, type MySubmission} from "../api/moderation";
import {describeApiError} from "../api/errors";
import {SubmissionStatusBadge} from "../components/dashboard/moderation/SubmissionStatusBadge";

const PAGE_SIZE = 20;

/**
 * A respondent's own submissions with their outcome and the moderator's
 * comment: how they learn a decision on the platform (#54, "platform
 * only" variant; a Discord DM is open question 1).
 */
export default function MySubmissionsPage() {
    const {t} = useTranslation();
    const [items, setItems] = useState<MySubmission[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getMySubmissions(page, PAGE_SIZE)
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
    }, [page, t]);

    return (
        <div className="min-h-screen w-full bg-s2 px-4 py-10">
            <div className="mx-auto max-w-2xl">
                <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-mu hover:text-tx">
                    <FiArrowLeft size={14}/>
                    MarForms
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-tx">{t("mySubmissions.title")}</h1>
                <p className="mt-1 text-sm text-mu">{t("mySubmissions.subtitle")}</p>

                {error && (
                    <div className="mt-6 rounded-lg border border-rdb bg-rdb px-3 py-2 text-xs text-rdt">
                        {error}
                    </div>
                )}

                {loading && items.length === 0 ? (
                    <p className="mt-8 text-sm text-mu">{t("common.loading")}</p>
                ) : items.length === 0 && !error ? (
                    <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-bd py-12">
                        <FiInbox size={28} className="text-mu/70"/>
                        <p className="text-sm text-mu">{t("mySubmissions.empty")}</p>
                    </div>
                ) : (
                    <ul className="mt-6 flex flex-col gap-3">
                        {items.map(s => (
                            <li key={s.id} className="rounded-xl border border-bd bg-sf p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <FiFileText size={14} className="flex-shrink-0 text-mu"/>
                                        <p className="truncate text-sm font-medium text-tx">
                                            {s.formTitle ?? t("mySubmissions.untitled")}
                                        </p>
                                    </div>
                                    <SubmissionStatusBadge status={s.status}/>
                                </div>
                                <p className="mt-1 text-xs text-mu">
                                    {t("mySubmissions.sent", {date: new Date(s.createdAt).toLocaleString()})}
                                    {s.decidedAt && ` · ${t("mySubmissions.decided", {date: new Date(s.decidedAt).toLocaleString()})}`}
                                </p>
                                {s.moderatorComment && (
                                    <div className="mt-3 flex gap-2 rounded-lg border border-bd bg-bg px-3 py-2">
                                        <FiMessageSquare size={13} className="mt-0.5 flex-shrink-0 text-mu"/>
                                        <p className="whitespace-pre-wrap break-words text-sm text-tx">{s.moderatorComment}</p>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {hasMore && (
                    <button
                        onClick={() => {
                            setLoading(true);
                            setPage(p => p + 1);
                        }}
                        disabled={loading}
                        className="mt-4 w-full rounded-lg border border-bd bg-sf py-2 text-sm text-mu hover:text-tx disabled:opacity-50"
                    >
                        {t("mySubmissions.more")}
                    </button>
                )}
            </div>
        </div>
    );
}
