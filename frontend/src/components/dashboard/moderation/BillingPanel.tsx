import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiInfo} from "react-icons/fi";
import {getGuildUsage, type GuildUsage, type MyGuild, type PlanMetric} from "../../../api/dashboard";
import {describeApiError} from "../../../api/errors";
import {ErrorState, Skeleton} from "../../../ui";

// Docs: docs/design/mockups/WsBilling.dc.html; ТЗ 4.9, 9.2 — billing is paused.

const METRICS: PlanMetric[] = ["ACTIVE_FORMS", "SUBMISSIONS_PER_MONTH", "MODERATORS", "FILE_STORAGE"];

/**
 * A server's «Тариф» (ТЗ 4.9): the current plan with its limits and what is
 * used of them, and the paid plans as «Скоро» — paying isn't possible yet.
 */
export default function BillingPanel({guild}: { guild: MyGuild }) {
    const {t} = useTranslation();
    const [usage, setUsage] = useState<GuildUsage | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        getGuildUsage(guild.guildId)
            .then(u => {
                if (cancelled) return;
                setUsage(u);
                setError(null);
            })
            .catch(e => !cancelled && setError(describeApiError(e, t("plan.loadError"))));
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, reloadKey, t]);

    const plan = usage ? usage.plan.charAt(0) + usage.plan.slice(1).toLowerCase() : "";
    const value = (metric: PlanMetric) => {
        const u = usage?.usage.find(x => x.metric === metric);
        if (!u) return "—";
        const fmt = (n: number) => metric === "FILE_STORAGE" ? t("plan.mb", {count: n}) : n.toLocaleString();
        return u.limit === null ? t("plan.usedUnlimited", {used: fmt(u.used)}) : t("plan.usedOf", {used: fmt(u.used), limit: fmt(u.limit)});
    };

    return (
        <div className="flex max-w-[980px] flex-col gap-5 pt-6">
            <div className="flex gap-2.5 rounded-[14px] border border-bd bg-s2 px-4 py-3.5 text-sm leading-[1.45]">
                <FiInfo size={18} aria-hidden="true" className="mt-px flex-none text-mu"/>
                <span><b>{t("plan.pausedTitle")}</b> {t("plan.pausedText")}</span>
            </div>

            {error ? (
                <ErrorState title={t("plan.loadError")} text={error} onRetry={() => setReloadKey(k => k + 1)} retryLabel={t("ui.retry")}/>
            ) : (
                <section className="flex flex-col gap-4 rounded-2xl border-[1.5px] border-pr bg-sf p-[22px]">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-prt">{t("plan.current")}</span>
                            <h2 className="m-0 text-2xl font-bold">{usage ? plan : <Skeleton className="h-7 w-20"/>}</h2>
                        </div>
                        <span className="rounded-full bg-prs px-3 py-1.5 text-[13px] font-semibold text-prt">{t("plan.active")}</span>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                        {METRICS.map(m => (
                            <div key={m} className="flex flex-col gap-1 rounded-xl bg-s2 p-3.5">
                                <span className="text-xs text-mu">{t(`plan.metric.${m}`)}</span>
                                <span className="text-lg font-semibold tabular-nums">{usage ? value(m) : <Skeleton className="h-5 w-16"/>}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 opacity-60" aria-disabled="true">
                {(["pro", "network"] as const).map(p => (
                    <div key={p} className="flex flex-col gap-2.5 rounded-2xl border border-dashed border-bd p-5">
                        <h3 className="m-0 text-lg font-bold">{t(`plan.${p}.name`)}</h3>
                        <span className="text-sm text-mu">{t(`plan.${p}.text`)}</span>
                        <button type="button" disabled className="h-10 rounded-xl border border-bd bg-s2 text-sm text-mu">{t("plan.soon")}</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
