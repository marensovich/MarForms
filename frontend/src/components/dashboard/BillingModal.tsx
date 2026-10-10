import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiCheckCircle, FiCreditCard, FiExternalLink} from "react-icons/fi";
import {type BillingStatus, getGuildBilling, type MyGuild, openBillingPortal, startCheckout} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import {Badge, Modal} from "./shared";

const PAID = new Set(["active", "trialing", "past_due"]);

/**
 * A server's subscription for its owner (E4.2, #98): current plan and
 * status, Stripe Checkout to subscribe, the Billing Portal to change or
 * cancel. Payment itself happens on Stripe's pages.
 */
export default function BillingModal({guild, onClose, checkoutResult}: {
    guild: MyGuild;
    onClose: () => void;
    /** Set when Stripe sent the owner back here after checkout. */
    checkoutResult?: "success" | "cancel" | null;
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
        <Modal title={t("billing.title")} subtitle={guild.guildName} onClose={onClose} width="max-w-lg">
            {checkoutResult === "success" && (
                <div className="mb-4 flex gap-2 rounded-lg border border-[#D7E8D9] bg-[#EEF4EE] px-3 py-2 text-xs text-[#3F6B4A]">
                    <FiCheckCircle size={14} className="mt-0.5 flex-shrink-0"/>
                    {t("billing.checkoutSuccess")}
                </div>
            )}
            {checkoutResult === "cancel" && (
                <div className="mb-4 rounded-lg border border-[#E4E4E7] bg-[#FAFAFB] px-3 py-2 text-xs text-[#55555F]">
                    {t("billing.checkoutCancelled")}
                </div>
            )}
            {error && (
                <div className="mb-4 rounded-lg border border-[#EAD4D3] bg-[#F7EEEE] px-3 py-2 text-xs text-[#8B4A46]">
                    {error}
                </div>
            )}

            {!billing ? (
                !error && <p className="text-sm text-[#8B8B96]">{t("common.loading")}</p>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] px-4 py-3">
                        <div>
                            <p className="text-xs text-[#8B8B96]">{t("billing.currentPlan")}</p>
                            <p className="text-lg font-semibold text-[#1E1E24]">
                                {t(`planUsage.plans.${billing.plan}`, {defaultValue: billing.plan})}
                            </p>
                            {billing.guildCount > 1 && (
                                <p className="text-xs text-[#6B6B76]">{t("billing.coversServers", {count: billing.guildCount})}</p>
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
                        <p className="text-sm text-[#55555F]">
                            {t(billing.cancelAtPeriodEnd ? "billing.endsOn" : "billing.renewsOn", {
                                date: new Date(billing.currentPeriodEnd).toLocaleDateString(),
                            })}
                        </p>
                    )}
                    {billing.status === "past_due" && (
                        <p className="rounded-lg border border-[#EFDFC0] bg-[#FBF3E4] px-3 py-2 text-xs text-[#92702A]">
                            {t("billing.pastDue")}
                        </p>
                    )}

                    {!billing.billingEnabled ? (
                        <p className="rounded-lg border border-[#E4E4E7] bg-[#FAFAFB] px-3 py-2 text-xs text-[#6B6B76]">
                            {t("billing.notConfigured")}
                        </p>
                    ) : subscribed ? (
                        <button
                            onClick={() => go(() => openBillingPortal(guild.guildId))}
                            disabled={busy}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-4 py-2.5 text-sm font-medium text-[#1E1E24] transition-colors hover:border-[#D4D4D9] disabled:opacity-50"
                        >
                            <FiExternalLink size={14}/>
                            {t("billing.manage")}
                        </button>
                    ) : (
                        <div className="space-y-2">
                            {billing.availablePlans.map(plan => (
                                <div key={plan}
                                     className="flex items-center justify-between rounded-xl border border-[#D8DCF5] bg-[#EEF0FB] px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold text-[#1E1E24]">
                                            {t(`planUsage.plans.${plan}`, {defaultValue: plan})}
                                        </p>
                                        <p className="text-xs text-[#55555F]">{t(`billing.planDesc.${plan}`, {defaultValue: ""})}</p>
                                    </div>
                                    <button
                                        onClick={() => go(() => startCheckout(guild.guildId, plan))}
                                        disabled={busy}
                                        className="flex items-center gap-1.5 rounded-lg bg-[#3730A3] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2D2682] disabled:opacity-50"
                                    >
                                        <FiCreditCard size={14}/>
                                        {t("billing.subscribe")}
                                    </button>
                                </div>
                            ))}
                            {billing.status !== "none" && (
                                <button onClick={() => go(() => openBillingPortal(guild.guildId))} disabled={busy}
                                        className="text-xs text-[#6B6B76] underline hover:text-[#1E1E24]">
                                    {t("billing.history")}
                                </button>
                            )}
                        </div>
                    )}
                    <p className="text-[11px] text-[#8B8B96]">{t("billing.stripeNote")}</p>
                </div>
            )}
        </Modal>
    );
}
