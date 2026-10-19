import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiSend} from "react-icons/fi";
import {type BotPresence, getBotPresence, setBotPresence} from "../../api/settings";
import {getFeedbackWebhook, setFeedbackWebhook, testFeedbackWebhook} from "../../api/feedback";
import {describeApiError} from "../../api/errors";
import {Button, Field, Input, Select, Skeleton, useToast} from "../../ui";

// Not in the mockups (2026-10-19): the bot's status is one for every server, and
// feedback about MarForms goes to a webhook of the platform's team. Each saves
// on its own, apart from the rest of the settings page.

const STATUSES = ["ONLINE", "IDLE", "DO_NOT_DISTURB", "INVISIBLE"] as const;
const ACTIVITIES = ["NONE", "PLAYING", "LISTENING", "WATCHING", "COMPETING", "CUSTOM"] as const;

/** «Статус бота»: online state and activity, shown on every server. */
export function BotPresenceForm() {
    const {t} = useTranslation();
    const toast = useToast();
    const [saved, setSaved] = useState<BotPresence | null>(null);
    const [draft, setDraft] = useState<BotPresence | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getBotPresence().then(p => {
            setSaved(p);
            setDraft(p);
        }).catch(() => undefined);
    }, []);

    if (!draft || !saved) return <Skeleton className="h-28 rounded-xl"/>;
    const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

    const save = async () => {
        setBusy(true);
        try {
            const next = await setBotPresence(draft);
            setSaved(next);
            setDraft(next);
            toast({tone: "success", text: t("adminSettings.bot.saved")});
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminSettings.bot.error"))});
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className="flex flex-wrap gap-3">
                <Field label={t("adminSettings.bot.status")} className="flex-[1_1_200px]">
                    <Select value={draft.status} onChange={e => setDraft({...draft, status: e.target.value})}>
                        {STATUSES.map(s => <option key={s} value={s}>{t(`adminSettings.bot.statuses.${s}`)}</option>)}
                    </Select>
                </Field>
                <Field label={t("adminSettings.bot.activity")} className="flex-[1_1_200px]">
                    <Select value={draft.activity} onChange={e => setDraft({...draft, activity: e.target.value})}>
                        {ACTIVITIES.map(a => <option key={a} value={a}>{t(`adminSettings.bot.activities.${a}`)}</option>)}
                    </Select>
                </Field>
            </div>
            {draft.activity !== "NONE" && (
                <Field label={t("adminSettings.bot.text")}>
                    <Input value={draft.text} maxLength={128} onChange={e => setDraft({...draft, text: e.target.value})}
                           placeholder={t("adminSettings.bot.textPlaceholder")}/>
                </Field>
            )}
            {dirty && (
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setDraft(saved)}>{t("common.cancel")}</Button>
                    <Button size="sm" loading={busy} onClick={save}>{t("common.save")}</Button>
                </div>
            )}
        </>
    );
}

/** «Обратная связь»: the webhook that gets bugs, ideas and reported problems. */
export function FeedbackWebhookForm() {
    const {t} = useTranslation();
    const toast = useToast();
    const [saved, setSaved] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState<"save" | "test" | null>(null);

    useEffect(() => {
        getFeedbackWebhook().then(w => {
            setSaved(w.webhookUrl);
            setDraft(w.webhookUrl);
        }).catch(() => setSaved(""));
    }, []);

    if (saved === null) return <Skeleton className="h-20 rounded-xl"/>;

    const save = async () => {
        setBusy("save");
        try {
            const next = await setFeedbackWebhook(draft.trim());
            setSaved(next.webhookUrl);
            setDraft(next.webhookUrl);
            toast({tone: "success", text: t("adminSettings.feedback.saved")});
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminSettings.feedback.error"))});
        } finally {
            setBusy(null);
        }
    };

    const test = async () => {
        setBusy("test");
        try {
            const r = await testFeedbackWebhook(draft.trim() || undefined);
            toast(r.ok ? {tone: "success", text: t("adminSettings.feedback.testOk")} : {tone: "error", text: t("adminSettings.feedback.testFailed")});
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminSettings.feedback.testFailed"))});
        } finally {
            setBusy(null);
        }
    };

    return (
        <>
            <div className="flex flex-wrap items-end gap-2">
                <Field label={t("adminSettings.feedback.url")} className="flex-[1_1_320px]">
                    <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="https://discord.com/api/webhooks/…"
                           className="font-mono text-[13px]"/>
                </Field>
                <Button variant="secondary" icon={<FiSend size={14} aria-hidden="true"/>} loading={busy === "test"}
                        disabled={!draft.trim()} onClick={test}>
                    {t("adminSettings.feedback.test")}
                </Button>
            </div>
            {!saved && <p className="m-0 text-xs text-mu">{t("adminSettings.feedback.off")}</p>}
            {draft.trim() !== saved && (
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setDraft(saved)}>{t("common.cancel")}</Button>
                    <Button size="sm" loading={busy === "save"} onClick={save}>{t("common.save")}</Button>
                </div>
            )}
        </>
    );
}
