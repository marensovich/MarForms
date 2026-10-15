import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiCheckCircle, FiCreditCard, FiExternalLink} from "react-icons/fi";
import {type BillingStatus, getGuildBilling, type MyGuild, openBillingPortal, startCheckout} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import {Badge, Frame} from "./shared";
import SharedServers from "./SharedServers";

const PAID = new Set(["active", "trialing", "past_due"]);

/**
 * A server's subscription for its owner (E4.2, #98): current plan and
 * status, Stripe Checkout to subscribe, the Billing Portal to change or
 * cancel. Payment itself happens on Stripe's pages.
 */
export default function BillingModal({guild, asPage, ownedGuilds, onClose, checkoutResult}: {
    guild: MyGuild;
    /** Every server the owner owns, to share the subscription with (E4.3). */
    ownedGuilds: MyGuild[];
    onClose: () => void;
    /** Set when Stripe sent the owner back here after checkout. */
    checkoutResult?: "success" | "cancel" | null;
    /** Shown as the workspace's «Тариф» tab instead of a dialog (#126). */
    asPage?: boolean;
}) {
    const {t} = useTranslation();
    const [billing, setBilling] = useState<BillingStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getGuildBilling(guild.guildId)
            .then(b => {
                if (!cancelled) setBilling(b);
            })
            .catch(e => {
                if (!cancelled) setError(describeApiError(e, t("billing.loadError")));
            });
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, t]);

    const go = async (action: () => Promise<{ url: string }>) => {
        setBusy(true);
        setError(null);
        try {
            const {url} = await action();
            window.location.assign(url);
        } catch (e) {
            setError(describeApiError(e, t("billing.actionError")));
            setBusy(false);
        }
    };

    const subscribed = billing ? PAID.has(billing.status) : false;

    return (
        <Frame asPage={asPage} title={t("billing.title")} subtitle={guild.guildName} onClose={onClose} width="max-w-lg">
            {checkoutResult === "success" && (
                <div className="mb-4 flex gap-2 rounded-lg border border-gnb bg-gnb px-3 py-2 text-xs text-gnt">
                    <FiCheckCircle size={14} className="mt-0.5 flex-shrink-0"/>
                    {t("billing.checkoutSuccess")}
                </div>
            )}
            {checkoutResult === "cancel" && (
                <div className="mb-4 rounded-lg border border-bd bg-bg px-3 py-2 text-xs text-mu">
                    {t("billing.checkoutCancelled")}
                </div>
            )}
            {error && (
                <div className="mb-4 rounded-lg border border-rdb bg-rdb px-3 py-2 text-xs text-rdt">
                    {error}
                </div>
            )}

            {!billing ? (
                !error && <p className="text-sm text-mu">{t("common.loading")}</p>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border border-bd bg-bg px-4 py-3">
                        <div>
                            <p className="text-xs text-mu">{t("billing.currentPlan")}</p>
                            <p className="text-lg font-semibold text-tx">
                                {t(`planUsage.plans.${billing.plan}`, {defaultValue: billing.plan})}
                            </p>
                            {billing.guildCount > 1 && (
                                <p className="text-xs text-mu">{t("billing.coversServers", {count: billing.guildCount})}</p>
                            )}
                        </div>
                        {billing.status !== "none" && (
                            <Badge color={billing.status === "active" || billing.status === "trialing" ? "green"
                                : billing.status === "past_due" ? "orange" : "default"} dot>
                                {t(`billing.status.${billing.status}`, {defaultValue: billing.status})}
                            </Badge>
                        )}
                    </div>

                    {subscribed && billing.currentPeriodEnd && (
                        <p className="text-sm text-mu">
                            {t(billing.cancelAtPeriodEnd ? "billing.endsOn" : "billing.renewsOn", {
                                date: new Date(billing.currentPeriodEnd).toLocaleDateString(),
                            })}
                        </p>
                    )}
                    {billing.status === "past_due" && (
                        <p className="rounded-lg border border-amb bg-amb px-3 py-2 text-xs text-amt">
                            {t("billing.pastDue")}
                        </p>
                    )}

                    {!billing.billingEnabled ? (
                        <p className="rounded-lg border border-bd bg-bg px-3 py-2 text-xs text-mu">
                            {t("billing.notConfigured")}
                        </p>
                    ) : subscribed ? (
                        <button
                            onClick={() => go(() => openBillingPortal(guild.guildId))}
                            disabled={busy}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-bd bg-sf px-4 py-2.5 text-sm font-medium text-tx transition-colors hover:border-bd disabled:opacity-50"
                        >
                            <FiExternalLink size={14}/>
                            {t("billing.manage")}
                        </button>
                    ) : (
                        <div className="space-y-2">
                            {billing.availablePlans.map(plan => (
                                <div key={plan}
                                     className="flex items-center justify-between rounded-xl border border-prs bg-prs px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold text-tx">
                                            {t(`planUsage.plans.${plan}`, {defaultValue: plan})}
                                        </p>
                                        <p className="text-xs text-mu">{t(`billing.planDesc.${plan}`, {defaultValue: ""})}</p>
                                    </div>
                                    <button
                                        onClick={() => go(() => startCheckout(guild.guildId, plan))}
                                        disabled={busy}
                                        className="flex items-center gap-1.5 rounded-lg bg-pr px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-prh disabled:opacity-50"
                                    >
                                        <FiCreditCard size={14}/>
                                        {t("billing.subscribe")}
                                    </button>
                                </div>
                            ))}
                            {billing.status !== "none" && (
                                <button onClick={() => go(() => openBillingPortal(guild.guildId))} disabled={busy}
                                        className="text-xs text-mu underline hover:text-tx">
                                    {t("billing.history")}
                                </button>
                            )}
                        </div>
                    )}
                    {(ownedGuilds.length > 1 || billing.guildCount > 1) && (
                        <SharedServers guild={guild} billing={billing} ownedGuilds={ownedGuilds} onChanged={setBilling}/>
                    )}

                    <p className="text-[11px] text-mu">{t("billing.stripeNote")}</p>
                </div>
            )}
        </Frame>
    );
}
