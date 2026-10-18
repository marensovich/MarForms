import {useEffect, useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiCheck, FiInfo, FiPlus, FiTrash2, FiX} from "react-icons/fi";
import {apiRequest} from "../../api/client";
import {createGuildWebhook, type DiscordChannel, getGuildChannels} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import type {WebhookConfig} from "../../types/forms";
import {cx, Spinner, useToast} from "../../ui";

// Docs: docs/design/mockups/Wizard4.dc.html; ТЗ 5.5, 8.5.

/** Same rule as the server (DiscordWebhookUrl), which refuses anything else. */
const WEBHOOK_URL = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api(?:\/v\d{1,2})?\/webhooks\/\d{1,25}\/[\w-]{1,256}\/?$/;
const EVENTS = ["SUBMISSION", "DECISION"] as const;

const eventsOf = (w: WebhookConfig) => (w.events?.length ? w.events : [...EVENTS]);

const STATUS = {
    HEALTHY: {cls: "bg-gnb text-gnt", icon: FiCheck},
    DEGRADED: {cls: "bg-amb text-amt", icon: FiAlertTriangle},
    INVALID: {cls: "bg-rdb text-rdt", icon: FiX},
} as const;

function useAgo() {
    const {i18n} = useTranslation();
    return (iso: string) => {
        const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        const rtf = new Intl.RelativeTimeFormat(i18n.language, {numeric: "auto"});
        if (minutes < 60) return rtf.format(-Math.max(0, minutes), "minute");
        if (minutes < 24 * 60) return rtf.format(-Math.round(minutes / 60), "hour");
        return rtf.format(-Math.round(minutes / 1440), "day");
    };
}

/**
 * «Уведомления» (ТЗ 5.5): the form's webhooks — channel, events, status and
 * the last delivery — with «Создать вебхук через бота» (pick a channel),
 * a URL pasted by hand, «Тест» and removal. Tokens never come back from the
 * server: a webhook shows as …/webhooks/<id>/*** (ТЗ 8.5).
 */
export default function NotificationsTab({guildId, formId, webhooks, onChange, beforeTest, onTested}: {
    guildId: string;
    formId: string | null;
    webhooks: WebhookConfig[];
    onChange: (webhooks: WebhookConfig[]) => void;
    /** Saves pending edits so the server knows the webhook being tested. */
    beforeTest: () => Promise<boolean>;
    /** The form was re-read after a test (its webhooks' status changed). */
    onTested: () => void;
}) {
    const {t} = useTranslation();
    const toast = useToast();
    const ago = useAgo();
    const ids = {channel: useId(), url: useId()};
    const [panel, setPanel] = useState<"bot" | "url" | null>(null);
    const [channels, setChannels] = useState<DiscordChannel[] | null>(null);
    const [channel, setChannel] = useState("");
    const [url, setUrl] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (panel !== "bot" || channels !== null) return;
        getGuildChannels(guildId).then(list => {
            setChannels(list);
            setChannel(c => c || list[0]?.id || "");
        }).catch(() => setChannels([]));
    }, [panel, channels, guildId]);

    const add = (webhook: WebhookConfig) => {
        onChange([...webhooks, {events: [...EVENTS], ...webhook}]);
        setPanel(null);
        setUrl("");
        setError(null);
    };

    const createByBot = async (channelId: string, replace?: number) => {
        setBusy("create");
        setError(null);
        try {
            const created = await createGuildWebhook(guildId, channelId);
            const name = channels?.find(c => c.id === channelId)?.name ?? webhooks[replace ?? -1]?.channelName;
            const webhook: WebhookConfig = {...(replace !== undefined ? webhooks[replace] : {events: [...EVENTS]}),
                url: created.url, channelId, channelName: name, health: null, healthReason: null, invalid: null};
            if (replace !== undefined) onChange(webhooks.map((w, i) => (i === replace ? webhook : w)));
            else add(webhook);
        } catch (e) {
            setError(describeApiError(e, t("builder.hooks.createFailed")));
        } finally {
            setBusy(null);
        }
    };

    const test = async (index: number) => {
        setBusy(`test-${index}`);
        try {
            if (!formId || !(await beforeTest())) return;
            const result = await apiRequest<{ ok: boolean; reason: string | null }>(
                `/guilds/${guildId}/forms/${formId}/webhooks/${index}/test`, {method: "POST"});
            toast(result.ok ? {tone: "success", text: t("builder.hooks.testOk")}
                : {tone: "error", text: t(`webhookHealth.reasons.${result.reason ?? "DELIVERY_FAILING"}`)});
            onTested();
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("builder.hooks.testFailed"))});
        } finally {
            setBusy(null);
        }
    };

    const toggleEvent = (index: number, event: string) => onChange(webhooks.map((w, i) => {
        if (i !== index) return w;
        const current = eventsOf(w);
        const next = current.includes(event) ? current.filter(e => e !== event) : [...current, event];
        return {...w, events: next.length ? next : current};
    }));

    return (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-[22px] px-4 pb-10 pt-8 md:px-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="m-0 text-[26px] font-bold">{t("builder.hooks.title")}</h1>
                    <p className="m-0 text-[15px] text-mu">{t("builder.hooks.text")}</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setPanel(p => (p === "url" ? null : "url"))}
                            className="h-[42px] rounded-xl px-3.5 text-sm font-semibold text-prt hover:bg-prs">{t("builder.hooks.pasteUrl")}</button>
                    <button type="button" onClick={() => setPanel(p => (p === "bot" ? null : "bot"))}
                            className="flex h-[42px] items-center gap-2 rounded-xl bg-pr px-4 text-sm font-semibold text-white hover:bg-prh">
                        <FiPlus size={16} aria-hidden="true"/>{t("builder.hooks.createByBot")}
                    </button>
                </div>
            </div>

            {panel === "bot" && (
                <div className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-bd bg-sf p-4">
                    <label htmlFor={ids.channel} className="flex min-w-[240px] flex-1 flex-col gap-1.5 text-[13px] font-semibold">
                        {t("builder.hooks.channel")}
                        <select id={ids.channel} value={channel} onChange={e => setChannel(e.target.value)} disabled={!channels?.length}
                                className="h-11 rounded-xl border border-bd bg-sf px-3 text-sm text-tx outline-none focus:border-pr">
                            {channels === null && <option>{t("common.loading")}</option>}
                            {channels?.length === 0 && <option>{t("builder.hooks.noChannels")}</option>}
                            {channels?.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                        </select>
                    </label>
                    <button type="button" disabled={!channel || busy === "create"} onClick={() => createByBot(channel)}
                            className="flex h-11 items-center gap-2 rounded-xl bg-pr px-4 text-sm font-semibold text-white hover:bg-prh disabled:opacity-50">
                        {busy === "create" && <Spinner/>}{t("builder.hooks.create")}
                    </button>
                </div>
            )}
            {panel === "url" && (
                <div className="flex flex-wrap items-end gap-2.5 rounded-2xl border border-bd bg-sf p-4">
                    <label htmlFor={ids.url} className="flex min-w-[280px] flex-1 flex-col gap-1.5 text-[13px] font-semibold">
                        {t("builder.hooks.url")}
                        <input id={ids.url} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…"
                               className="h-11 rounded-xl border border-bd bg-sf px-3 font-mono text-[13px] text-tx outline-none focus:border-pr"/>
                    </label>
                    <button type="button" disabled={!WEBHOOK_URL.test(url.trim())} onClick={() => add({url: url.trim()})}
                            className="h-11 rounded-xl bg-pr px-4 text-sm font-semibold text-white hover:bg-prh disabled:opacity-50">
                        {t("builder.hooks.add")}
                    </button>
                    {url.trim() && !WEBHOOK_URL.test(url.trim()) && (
                        <span role="alert" className="w-full text-xs text-rdt">{t("builder.hooks.badUrl")}</span>
                    )}
                </div>
            )}
            {error && <p role="alert" className="m-0 rounded-[10px] bg-rdb px-3 py-2 text-[13px] text-rdt">{error}</p>}

            {webhooks.length > 0 && (
                <ul className="m-0 list-none rounded-2xl border border-bd bg-sf p-0">
                    {webhooks.map((w, i) => {
                        const health = w.invalid ? "INVALID" : w.health ?? null;
                        const status = health ? STATUS[health] : null;
                        const name = w.channelName ? `#${w.channelName}` : t("builder.hooks.unnamed", {id: w.url.match(/webhooks\/(\d+)/)?.[1]?.slice(-4) ?? ""});
                        return (
                            <li key={i} className="flex flex-wrap items-center gap-4 border-b border-bd px-5 py-4 last:border-0">
                                <span className="grid h-10 w-10 place-items-center rounded-xl bg-s2 text-lg font-semibold text-mu" aria-hidden="true">#</span>
                                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                                    <span className="text-[15px] font-semibold">{name}</span>
                                    <span className="flex flex-wrap gap-1.5" role="group" aria-label={t("builder.hooks.events")}>
                                        {EVENTS.map(ev => {
                                            const on = eventsOf(w).includes(ev);
                                            return (
                                                <button key={ev} type="button" aria-pressed={on} onClick={() => toggleEvent(i, ev)}
                                                        className={cx("rounded-full border px-2 py-0.5 text-xs",
                                                            on ? "border-pr bg-prs text-prt" : "border-bd text-mu")}>
                                                    {t(`builder.hooks.event.${ev}`)}
                                                </button>
                                            );
                                        })}
                                    </span>
                                    <span className={cx("text-[13px]", health === "INVALID" ? "text-rdt" : health === "DEGRADED" ? "text-amt" : "text-mu")}>
                                        {health && health !== "HEALTHY"
                                            ? t(`webhookHealth.reasons.${w.healthReason ?? (health === "INVALID" ? "WEBHOOK_DELETED" : "DELIVERY_FAILING")}`)
                                            : w.lastDeliveredAt ? t("builder.hooks.lastDelivery", {ago: ago(w.lastDeliveredAt)}) : t("builder.hooks.notYet")}
                                    </span>
                                </div>
                                <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-xs font-semibold",
                                    status ? status.cls : "bg-s2 text-mu")}>
                                    {status && <status.icon size={12} aria-hidden="true"/>}
                                    {t(`builder.hooks.status.${health ?? "UNKNOWN"}`)}
                                </span>
                                <div className="flex gap-1.5">
                                    {health === "INVALID" && w.channelId ? (
                                        <button type="button" disabled={busy !== null} onClick={() => createByBot(w.channelId!, i)}
                                                className="h-9 rounded-[10px] border border-bd bg-sf px-3 text-[13px] font-medium text-tx hover:bg-s2">
                                            {t("builder.hooks.recreate")}
                                        </button>
                                    ) : (
                                        <button type="button" disabled={busy !== null || !formId} onClick={() => test(i)}
                                                className="flex h-9 items-center gap-1.5 rounded-[10px] border border-bd bg-sf px-3 text-[13px] font-medium text-tx hover:bg-s2 disabled:opacity-50">
                                            {busy === `test-${i}` && <Spinner/>}{t("builder.hooks.test")}
                                        </button>
                                    )}
                                    <button type="button" onClick={() => onChange(webhooks.filter((_, j) => j !== i))}
                                            aria-label={t("builder.hooks.remove", {name})}
                                            className="grid h-9 w-9 place-items-center rounded-[10px] text-mu hover:bg-rdb hover:text-rdt">
                                        <FiTrash2 size={16} aria-hidden="true"/>
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="flex gap-2.5 rounded-[14px] bg-s2 px-4 py-3.5 text-sm leading-[1.45] text-mu">
                <FiInfo size={18} aria-hidden="true" className="mt-px flex-none"/>{t("builder.hooks.later")}
            </div>
        </div>
    );
}
