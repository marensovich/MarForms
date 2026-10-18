import {type ReactNode, useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiAlertOctagon, FiSend} from "react-icons/fi";
import {describeApiError} from "../../api/errors";
import {fetchLogWebhook, fetchSettings, type LogDelivery, type SystemSettings, testLogWebhook, updateSettings} from "../../api/settings";
import type {AuditAction} from "../../types/logs";
import {Button, ConfirmDialog, cx, ErrorState, Field, Input, SegmentedControl, Skeleton, Switch, Textarea, useToast} from "../../ui";
import {useLeaveGuard} from "./useLeaveGuard";

// Docs: docs/design/mockups/AdminSettings.dc.html; ТЗ 6.7, 7.3.

const SECTIONS = ["general", "webhook", "filters", "embed", "bans"] as const;
type Section = typeof SECTIONS[number];

/** The action types the journal can write, in the order of ТЗ 6.5. */
const ACTIONS: AuditAction[] = [
    "USER_LOGIN", "USER_BANNED", "USER_UNBANNED", "USER_TIMED_OUT", "USER_TIMEOUT_LIFTED", "USER_ROLES_UPDATED",
    "FORM_CREATED", "FORM_UPDATED", "FORM_STATUS_CHANGED", "FORM_DELETED",
    "SUBMISSION_CREATED", "SUBMISSION_DELETED", "SUBMISSION_DECIDED", "SUBMISSION_DM_FAILED",
    "MODERATOR_ADDED", "MODERATOR_REMOVED", "GUILD_BAN_ADDED", "GUILD_BAN_REMOVED", "GUILD_CONNECTED", "GUILD_ROLE_REVOKED",
    "ROLE_CREATED", "ROLE_UPDATED", "ROLE_DELETED", "SETTINGS_UPDATED",
    "BOT_REMOVED", "BOT_RECONNECTED", "BOT_PERMISSIONS_MISSING", "WEBHOOK_FAILING",
];

/** The variables every notification fills (ТЗ 6.7), with what the preview shows for each. */
const VARIABLES: [string, string][] = [
    ["{user.mention}", "@dmitry_ballas"], ["{user.name}", "dmitry_ballas"], ["{user.id}", "412988120773"],
    ["{form.title}", "Набор в LSPD"], ["{form.url}", "marforms.app/f/lspd-academy"], ["{server.name}", "Los Santos RP"],
    ["{status}", "На рассмотрении"], ["{date}", new Date().toLocaleDateString("ru-RU")],
];

/** Which settings belong to which section, for «Несохранённые изменения · …». */
const FIELDS: Record<Section, (keyof SystemSettings)[]> = {
    general: ["systemName", "systemContact", "uiLanguage"],
    webhook: ["logWebhookUrl"],
    filters: ["logEnabledActions"],
    embed: ["globalEmbedTitle", "globalEmbedDescription", "globalEmbedColor", "globalEmbedFooterText", "globalEmbedFooterIcon",
        "globalEmbedAuthorName", "globalEmbedAuthorIcon", "globalEmbedAuthorUrl", "globalEmbedThumbnail", "globalEmbedImage"],
    bans: ["banMessage", "banAdminContact"],
};

/** The enabled actions; an empty setting means every action, including ones added later. */
const enabledOf = (raw: string) => new Set<string>(raw ? raw.split(",").map(s => s.trim()).filter(Boolean) : ACTIONS);
const rawOf = (enabled: Set<string>) => ACTIONS.every(a => enabled.has(a)) ? "" : ACTIONS.filter(a => enabled.has(a)).join(",");

const substitute = (text: string) => VARIABLES.reduce((s, [v, sample]) => s.split(v).join(sample), text);

/**
 * Платформа · Настройки (ТЗ 6.7, SYSTEM_ADMIN): one long page with an anchor
 * menu and a sticky «Несохранённые изменения · Сохранить» — general settings,
 * the journal webhook with «Отправить тест» and its last delivery, the journal
 * filters (a disabled action is written nowhere), the shared embed with
 * variables inserted by a click and a live Discord preview, and the text of
 * restricted accounts with a live «Доступ ограничен» preview.
 */
export default function SettingsTab() {
    const {t, i18n} = useTranslation();
    const toast = useToast();
    const [saved, setSaved] = useState<SystemSettings | null>(null);
    const [draft, setDraft] = useState<SystemSettings | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [active, setActive] = useState<Section>("general");
    const [delivery, setDelivery] = useState<LogDelivery | null>(null);
    const [testing, setTesting] = useState(false);
    const lastField = useRef<{ key: keyof SystemSettings; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchSettings()
            .then(s => {
                if (cancelled) return;
                setSaved(s);
                setDraft(s);
                setLoadError(null);
            })
            .catch(e => !cancelled && setLoadError(describeApiError(e, t("adminSettings.loadError"))));
        fetchLogWebhook().then(w => !cancelled && setDelivery(w.lastDelivery)).catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [reloadKey, t]);

    const changedSections = saved && draft ? SECTIONS.filter(s => FIELDS[s].some(k => (draft[k] ?? "") !== (saved[k] ?? ""))) : [];
    const dirty = changedSections.length > 0;
    const guard = useLeaveGuard(dirty);

    const set = (key: keyof SystemSettings, value: string) => setDraft(d => d && {...d, [key]: value});
    const remember = (key: keyof SystemSettings, e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => {
        lastField.current = {key, el: e.currentTarget};
    };
    /** A variable goes where the cursor was in the embed field last focused (the text by default). */
    const insert = (variable: string) => {
        if (!draft) return;
        const target = lastField.current ?? null;
        const key = target?.key ?? "globalEmbedDescription";
        const value = draft[key] ?? "";
        const start = target?.el.selectionStart ?? value.length;
        const end = target?.el.selectionEnd ?? value.length;
        set(key, value.slice(0, start) + variable + value.slice(end));
        requestAnimationFrame(() => {
            if (!target) return;
            target.el.focus();
            target.el.setSelectionRange(start + variable.length, start + variable.length);
        });
    };
    const save = async () => {
        if (!draft) return;
        setSaving(true);
        try {
            const next = await updateSettings(draft);
            setSaved(next);
            setDraft(next);
            toast({tone: "success", text: t("adminSettings.saved")});
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminSettings.saveError"))});
        } finally {
            setSaving(false);
        }
    };
    const test = async () => {
        setTesting(true);
        try {
            const d = await testLogWebhook(draft?.logWebhookUrl);
            setDelivery(d);
            toast({tone: d.ok ? "success" : "error", text: d.ok ? t("adminSettings.webhook.testOk") : t("adminSettings.webhook.testFailed", {status: d.status})});
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminSettings.webhook.testError"))});
        } finally {
            setTesting(false);
        }
    };
    const jump = (s: Section) => {
        setActive(s);
        document.getElementById(`settings-${s}`)?.scrollIntoView({behavior: "smooth", block: "start"});
    };

    if (loadError) return <ErrorState title={t("adminSettings.loadError")} text={loadError} onRetry={() => setReloadKey(k => k + 1)}/>;
    if (!draft || !saved) {
        return (
            <div className="flex flex-col gap-4" aria-busy="true">
                <Skeleton className="h-10 w-60 rounded-lg"/>
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-48 rounded-[14px]"/>)}
            </div>
        );
    }

    const enabled = enabledOf(draft.logEnabledActions ?? "");
    const webhookActive = !!saved.logWebhookUrl;
    const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"});

    return (
        <div className="flex flex-col gap-5 pb-20">
            <div className="flex flex-col gap-1.5">
                <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em]">{t("adminSettings.title")}</h1>
                <p className="m-0 text-sm text-mu">{t("adminSettings.subtitle")}</p>
            </div>

            <div className="flex flex-wrap items-start gap-6">
                <nav aria-label={t("adminSettings.menu")} className="sticky top-4 flex flex-[1_1_180px] flex-col gap-0.5 max-[900px]:static max-[900px]:flex-row max-[900px]:flex-wrap">
                    {SECTIONS.map(s => (
                        <a key={s} href={`#settings-${s}`} aria-current={active === s ? "true" : undefined}
                           onClick={e => {
                               e.preventDefault();
                               jump(s);
                           }}
                           className={cx("rounded-[9px] px-3 py-2 text-[13px] font-medium no-underline",
                               active === s ? "bg-prs text-prt" : "text-mu hover:bg-s2 hover:text-tx")}>
                            {t(`adminSettings.section.${s}`)}
                            {changedSections.includes(s) && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-wr align-middle" aria-hidden="true"/>}
                        </a>
                    ))}
                </nav>

                <div className="flex min-w-0 flex-[999_1_620px] flex-col gap-5">
                    <Card id="general" title={t("adminSettings.section.general")} text={t("adminSettings.general.text")}>
                        <Field label={t("adminSettings.general.name")}>
                            <Input value={draft.systemName ?? ""} onChange={e => set("systemName", e.target.value)} maxLength={60}/>
                        </Field>
                        <Field label={t("adminSettings.general.contact")}>
                            <Input value={draft.systemContact ?? ""} onChange={e => set("systemContact", e.target.value)} maxLength={200}/>
                        </Field>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[13px] font-semibold">{t("adminSettings.general.language")}</span>
                            <SegmentedControl ariaLabel={t("adminSettings.general.language")} value={draft.uiLanguage === "en" ? "en" : "ru"}
                                              onChange={v => set("uiLanguage", v)}
                                              options={[{value: "ru", label: "Русский"}, {value: "en", label: "English"}]}/>
                        </div>
                    </Card>

                    <Card id="webhook" title={t("adminSettings.section.webhook")} text={t("adminSettings.webhook.text")}
                          badge={<span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", webhookActive ? "bg-gnb text-gnt" : "bg-s2 text-mu")}>
                              {t(webhookActive ? "adminSettings.webhook.active" : "adminSettings.webhook.off")}
                          </span>}>
                        <div className="flex flex-wrap items-end gap-2">
                            <Field label={t("adminSettings.webhook.url")} className="flex-[1_1_320px]">
                                <Input value={draft.logWebhookUrl ?? ""} onChange={e => set("logWebhookUrl", e.target.value)}
                                       placeholder="https://discord.com/api/webhooks/…" className="font-mono text-[13px]"/>
                            </Field>
                            <Button variant="secondary" icon={<FiSend size={14} aria-hidden="true"/>} loading={testing}
                                    disabled={!draft.logWebhookUrl} onClick={test}>
                                {t("adminSettings.webhook.test")}
                            </Button>
                        </div>
                        <p className={cx("m-0 text-xs", delivery && !delivery.ok ? "text-rdt" : "text-mu")}>
                            {delivery
                                ? t("adminSettings.webhook.last", {date: when(delivery.at), status: delivery.ok ? `${delivery.status} OK` : delivery.status})
                                : t("adminSettings.webhook.never")}
                        </p>
                    </Card>

                    <Card id="filters" title={t("adminSettings.section.filters")} text={t("adminSettings.filters.text")}>
                        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-x-5 gap-y-1 p-0">
                            {ACTIONS.map(a => (
                                <li key={a} className="flex items-center justify-between gap-3 border-b border-bd py-2">
                                    <span className="text-[13px]">{t(`logs.actions.${a}`)}</span>
                                    <Switch checked={enabled.has(a)} ariaLabel={t(`logs.actions.${a}`)}
                                            onChange={on => {
                                                const next = new Set(enabled);
                                                if (on) next.add(a);
                                                else next.delete(a);
                                                set("logEnabledActions", rawOf(next));
                                            }}/>
                                </li>
                            ))}
                        </ul>
                    </Card>

                    <Card id="embed" title={t("adminSettings.section.embed")} text={t("adminSettings.embed.text")}>
                        <div className="flex flex-wrap gap-5">
                            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
                                <Field label={t("adminSettings.embed.title")}>
                                    <Input value={draft.globalEmbedTitle ?? ""} onChange={e => set("globalEmbedTitle", e.target.value)}
                                           onFocus={e => remember("globalEmbedTitle", e)} onSelect={e => remember("globalEmbedTitle", e)} maxLength={256}/>
                                </Field>
                                <Field label={t("adminSettings.embed.description")}>
                                    <Textarea value={draft.globalEmbedDescription ?? ""} rows={4} onChange={e => set("globalEmbedDescription", e.target.value)}
                                              onFocus={e => remember("globalEmbedDescription", e)} onSelect={e => remember("globalEmbedDescription", e)} maxLength={4000}/>
                                </Field>
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[13px] font-semibold">{t("adminSettings.embed.color")}</span>
                                        <span className="flex items-center gap-2">
                                            <input type="color" value={/^#[0-9a-f]{6}$/i.test(draft.globalEmbedColor ?? "") ? draft.globalEmbedColor : "#5865F2"}
                                                   onChange={e => set("globalEmbedColor", e.target.value)} aria-label={t("adminSettings.embed.color")}
                                                   className="h-[38px] w-12 cursor-pointer rounded-[10px] border border-bd bg-sf"/>
                                            <Input value={draft.globalEmbedColor ?? ""} onChange={e => set("globalEmbedColor", e.target.value)}
                                                   aria-label={t("adminSettings.embed.colorHex")} className="w-28 font-mono" maxLength={7}/>
                                        </span>
                                    </div>
                                    <Field label={t("adminSettings.embed.footer")} className="flex-[1_1_180px]">
                                        <Input value={draft.globalEmbedFooterText ?? ""} onChange={e => set("globalEmbedFooterText", e.target.value)}
                                               onFocus={e => remember("globalEmbedFooterText", e)} onSelect={e => remember("globalEmbedFooterText", e)} maxLength={2048}/>
                                    </Field>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[13px] font-semibold">{t("adminSettings.embed.variables")}</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {VARIABLES.map(([v]) => (
                                            <button key={v} type="button" onMouseDown={e => e.preventDefault()} onClick={() => insert(v)}
                                                    title={t("adminSettings.embed.insert")}
                                                    className="rounded-md border border-bd bg-s2 px-2 py-1 font-mono text-xs text-tx hover:border-pr hover:bg-prs">
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <details className="rounded-[10px] border border-bd">
                                    <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold">{t("adminSettings.embed.more")}</summary>
                                    <div className="flex flex-col gap-3 border-t border-bd p-3">
                                        {(["globalEmbedAuthorName", "globalEmbedAuthorIcon", "globalEmbedAuthorUrl", "globalEmbedThumbnail",
                                            "globalEmbedImage", "globalEmbedFooterIcon"] as const).map(k => (
                                            <Field key={k} label={t(`adminSettings.embed.${k}`)}>
                                                <Input value={draft[k] ?? ""} onChange={e => set(k, e.target.value)}
                                                       onFocus={e => k === "globalEmbedAuthorName" && remember(k, e)}/>
                                            </Field>
                                        ))}
                                    </div>
                                </details>
                            </div>
                            <DiscordPreview settings={draft}/>
                        </div>
                    </Card>

                    <Card id="bans" title={t("adminSettings.section.bans")} text={t("adminSettings.bans.text")}>
                        <div className="flex flex-wrap gap-5">
                            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
                                <Field label={t("adminSettings.bans.message")}>
                                    <Textarea value={draft.banMessage ?? ""} rows={4} onChange={e => set("banMessage", e.target.value)} maxLength={1000}/>
                                </Field>
                                <Field label={t("adminSettings.bans.contact")}>
                                    <Input value={draft.banAdminContact ?? ""} onChange={e => set("banAdminContact", e.target.value)} maxLength={200}/>
                                </Field>
                            </div>
                            <RestrictedPreview message={draft.banMessage ?? ""} contact={draft.banAdminContact ?? ""}/>
                        </div>
                    </Card>
                </div>
            </div>

            {dirty && (
                <div role="region" aria-label={t("adminSettings.unsaved")}
                     className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-[14px] border border-bd bg-inv px-4 py-3 text-white shadow-modal">
                    <span className="flex-1 text-sm">
                        {t("adminSettings.unsaved")} · {changedSections.map(s => t(`adminSettings.section.${s}`)).join(", ")}
                    </span>
                    <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setDraft(saved)}>{t("adminSettings.reset")}</Button>
                    <Button loading={saving} onClick={save}>{t("common.save")}</Button>
                </div>
            )}
            <ConfirmDialog open={guard.pending !== null} tone="primary" title={t("adminSettings.leaveTitle")} text={t("adminSettings.leaveText")}
                           confirmLabel={t("adminSettings.leave")} cancelLabel={t("adminSettings.stay")}
                           onConfirm={guard.leave} onCancel={guard.stay}/>
        </div>
    );
}

function Card({id, title, text, badge, children}: { id: Section; title: string; text: string; badge?: ReactNode; children: ReactNode }) {
    return (
        <section id={`settings-${id}`} aria-labelledby={`settings-${id}-title`} className="scroll-mt-4 rounded-[14px] border border-bd bg-sf p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                    <h2 id={`settings-${id}-title`} className="m-0 text-base font-bold">{title}</h2>
                    <p className="m-0 text-[13px] text-mu">{text}</p>
                </div>
                {badge}
            </div>
            <div className="flex flex-col gap-4">{children}</div>
        </section>
    );
}

/** The shared embed as Discord shows it under a notification, with sample values. */
function DiscordPreview({settings}: { settings: SystemSettings }) {
    const {t} = useTranslation();
    const color = /^#[0-9a-f]{6}$/i.test(settings.globalEmbedColor ?? "") ? settings.globalEmbedColor : "#5865F2";
    const empty = !settings.globalEmbedTitle && !settings.globalEmbedDescription && !settings.globalEmbedFooterText && !settings.globalEmbedAuthorName;
    return (
        <figure className="m-0 flex min-w-0 flex-[1_1_300px] flex-col gap-2">
            <figcaption className="text-[13px] font-semibold">{t("adminSettings.embed.preview")}</figcaption>
            <div data-theme="dark" className="rounded-[10px] bg-[#313338] p-4 text-[#DBDEE1]">
                <div className="flex gap-3">
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[#5865F2] text-sm font-bold text-white" aria-hidden="true">M</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm">
                            <b className="text-white">MarForms</b>
                            <span className="ml-1.5 rounded bg-[#5865F2] px-1 py-px text-[10px] font-bold text-white">{t("adminSettings.embed.bot")}</span>
                        </span>
                        {empty ? (
                            <p className="m-0 text-[13px] text-[#949BA4]">{t("adminSettings.embed.empty")}</p>
                        ) : (
                            <div className="flex flex-col gap-1.5 rounded border-l-4 bg-[#2B2D31] p-3" style={{borderColor: color}}>
                                {settings.globalEmbedAuthorName && <span className="text-xs font-semibold text-white">{substitute(settings.globalEmbedAuthorName)}</span>}
                                {settings.globalEmbedTitle && <b className="text-sm text-white">{substitute(settings.globalEmbedTitle)}</b>}
                                {settings.globalEmbedDescription && (
                                    <p className="m-0 whitespace-pre-wrap break-words text-[13px]">{substitute(settings.globalEmbedDescription)}</p>
                                )}
                                {settings.globalEmbedFooterText && <span className="text-[11px] text-[#949BA4]">{substitute(settings.globalEmbedFooterText)}</span>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </figure>
    );
}

/** «Доступ ограничен» as a restricted user sees it (ТЗ 3.5). */
function RestrictedPreview({message, contact}: { message: string; contact: string }) {
    const {t} = useTranslation();
    return (
        <figure className="m-0 flex min-w-0 flex-[1_1_280px] flex-col gap-2">
            <figcaption className="text-[13px] font-semibold">{t("adminSettings.bans.preview")}</figcaption>
            <div className="flex flex-col items-center gap-2.5 rounded-[14px] border border-bd bg-bg p-5 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rdb px-2.5 py-1 text-[11px] font-semibold text-rdt">
                    <FiAlertOctagon size={12} aria-hidden="true"/>{t("adminSettings.bans.badge")}
                </span>
                <b className="text-base">{t("adminSettings.bans.heading")}</b>
                <p className="m-0 whitespace-pre-wrap text-[13px] text-mu">{message || t("adminSettings.bans.noMessage")}</p>
                <span className="text-xs text-mu">{t("adminSettings.bans.sampleReason")}</span>
                {contact && <span className="text-[13px] font-semibold text-prt">{contact}</span>}
            </div>
        </figure>
    );
}
