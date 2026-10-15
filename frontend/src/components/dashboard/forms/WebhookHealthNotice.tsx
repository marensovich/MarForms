import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiXOctagon} from "react-icons/fi";
import type {WebhookConfig, WebhookHealth} from "../../../types/forms";

function effectiveHealth(wh: Pick<WebhookConfig, "invalid" | "health">): WebhookHealth {
    if (wh.invalid) return "INVALID";
    return wh.health ?? "HEALTHY";
}

/**
 * Why one webhook's notifications may not be arriving (E2.4, #75).
 * Renders nothing for a healthy webhook.
 */
export default function WebhookHealthNotice({webhook}: { webhook: WebhookConfig }) {
    const {t} = useTranslation();
    const health = effectiveHealth(webhook);
    if (health === "HEALTHY") return null;
    const invalid = health === "INVALID";
    const reason = webhook.healthReason ?? (invalid ? "WEBHOOK_DELETED" : "DELIVERY_FAILING");
    const Icon = invalid ? FiXOctagon : FiAlertTriangle;
    return (
        <div className={`flex gap-2 border-b px-4 py-2.5 text-xs ${invalid
            ? "border-rdb bg-rdb text-rdt"
            : "border-amb bg-amb text-amt"}`}>
            <Icon size={13} className="mt-0.5 flex-shrink-0"/>
            <div>
                <p className="font-medium">{t(`webhookHealth.${health}`)}</p>
                <p className="mt-0.5">{t(`webhookHealth.reasons.${reason}`, {defaultValue: webhook.lastError ?? ""})}</p>
            </div>
        </div>
    );
}
