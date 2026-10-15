import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {getGuildUsage, type GuildUsage} from "../../api/dashboard";

/**
 * The guild's plan and its usage against each limit (E4.1, #95). Shown to
 * the owner; an unlimited metric shows the count alone.
 */
export default function PlanUsage({guildId, refreshKey}: { guildId: string; refreshKey?: unknown }) {
    const {t} = useTranslation();
    const [usage, setUsage] = useState<GuildUsage | null>(null);

    useEffect(() => {
        let cancelled = false;
        getGuildUsage(guildId)
            .then(u => {
                if (!cancelled) setUsage(u);
            })
            .catch(() => {
                if (!cancelled) setUsage(null);
            });
        return () => {
            cancelled = true;
        };
    }, [guildId, refreshKey]);

    if (!usage) return null;

    return (
        <div className="mb-5 rounded-xl border border-bd bg-sf px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-mu">{t("planUsage.title")}</p>
                <span className="rounded-full border border-prs bg-prs px-2 py-0.5 text-[11px] font-medium text-prt">
                    {t(`planUsage.plans.${usage.plan}`, {defaultValue: usage.plan})}
                </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {usage.usage.map(u => {
                    const limited = u.limit !== null;
                    const ratio = limited ? Math.min(1, u.used / Math.max(1, u.limit!)) : 0;
                    const atLimit = limited && u.used >= u.limit!;
                    return (
                        <div key={u.metric}>
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="text-xs text-mu">{t(`planUsage.metrics.${u.metric}`)}</p>
                                <p className={`text-sm font-semibold tabular-nums ${atLimit ? "text-rdt" : "text-tx"}`}>
                                    {u.used}{limited ? ` / ${u.limit}` : ""}
                                </p>
                            </div>
                            {limited ? (
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-s2">
                                    <div
                                        className={`h-full rounded-full ${atLimit ? "bg-dg" : ratio > 0.8 ? "bg-wr" : "bg-pr"}`}
                                        style={{width: `${Math.round(ratio * 100)}%`}}
                                    />
                                </div>
                            ) : (
                                <p className="mt-1 text-[11px] text-mu">{t("planUsage.unlimited")}</p>
                            )}
                            {atLimit && (
                                <p className="mt-1 text-[11px] text-rdt">
                                    {u.metric === "SUBMISSIONS_PER_MONTH"
                                        ? t("planUsage.submissionsOver")
                                        : t("planUsage.atLimit")}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
