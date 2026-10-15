import {useTranslation} from "react-i18next";
import type {SubmissionEvent} from "../../api/moderation";

/**
 * What happened to a submission, oldest first (#118, ТЗ ФТ-4.5.3): sent,
 * decided, reopened, sent again — who, when, the new status and the comment.
 */
export default function SubmissionHistory({events}: { events: SubmissionEvent[] }) {
    const {t, i18n} = useTranslation();
    if (events.length === 0) return null;
    return (
        <section aria-labelledby="submission-history" className="flex flex-col gap-2">
            <h3 id="submission-history" className="m-0 text-xs font-semibold uppercase tracking-wider text-mu">
                {t("submissionHistory.title")}
            </h3>
            <ol className="m-0 flex list-none flex-col gap-0 border-l border-bd p-0 pl-4">
                {events.map((e, i) => (
                    <li key={i} className="relative pb-3 last:pb-0">
                        <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-pr" aria-hidden="true"/>
                        <p className="m-0 text-[13px] text-tx">
                            <b>{t(`submissionHistory.${e.type}`, {status: t(`mySubmissions.status.${e.to}`)})}</b>
                            {e.actorName && <span className="text-mu"> · {e.actorName}</span>}
                        </p>
                        <p className="m-0 text-xs text-mu">
                            {new Date(e.at).toLocaleString(i18n.language, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})}
                        </p>
                        {e.comment && <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] leading-snug text-tx">«{e.comment}»</p>}
                    </li>
                ))}
            </ol>
        </section>
    );
}
