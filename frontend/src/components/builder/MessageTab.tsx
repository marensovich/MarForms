import {type ReactNode, useEffect, useId, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiAtSign, FiCopy, FiHash} from "react-icons/fi";
import {type DiscordRole, getGuildRoles} from "../../api/dashboard";
import {useAuth} from "../../hooks/useAuth";
import type {FormField, WebhookConfig} from "../../types/forms";
import {Button, Combobox, cx, discordColor, Field, Input, Switch, Textarea, useToast} from "../../ui";
import DiscordPreview from "./DiscordPreview";
import {DEFAULT_COLOR, DEFAULT_SENDER, fromHex, isLink, messageOf, toHex} from "./discordMessage";

// Not in the mockups: the owner's answers of 2026-10-19 — a report is sent to
// Discord as is, and a text can go above it: the form's own for every channel,
// then each channel's (role mentions and the like). Each channel has its own
// embed too, with a preview of what Discord will show.

const MAX = 2000;
const VARIABLES = ["{user.mention}", "{user.name}", "{form.title}", "{form.url}", "{server.name}", "{date}"];

/** The embed's look, copied to other channels by «Применить ко всем». */
const LOOK: (keyof WebhookConfig)[] = ["botName", "avatarUrl", "color", "embedTitle", "titleUrl", "embedDescription",
    "authorName", "authorIconUrl", "authorUrl", "thumbnailUrl", "imageUrl", "fieldsInline", "footerText", "footerIconUrl", "timestamp"];

/** A text box with «упомянуть роль» and the variables, inserting where the caret is. */
function MessageBox({id, value, onChange, roles, placeholder}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    roles: DiscordRole[];
    placeholder: string;
}) {
    const {t} = useTranslation();
    const area = useRef<HTMLTextAreaElement>(null);
    const [picking, setPicking] = useState(false);

    const insert = (text: string) => {
        const el = area.current;
        const at = el ? el.selectionStart : value.length;
        const end = el ? el.selectionEnd : value.length;
        const next = (value.slice(0, at) + text + value.slice(end)).slice(0, MAX);
        onChange(next);
        requestAnimationFrame(() => {
            el?.focus();
            el?.setSelectionRange(at + text.length, at + text.length);
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <textarea id={id} ref={area} value={value} maxLength={MAX} rows={3} placeholder={placeholder}
                      onChange={e => onChange(e.target.value)}
                      className="w-full resize-y rounded-xl border border-bd bg-sf px-3.5 py-2.5 font-mono text-[13px] text-tx outline-none focus:border-pr"/>
            <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => setPicking(p => !p)} aria-expanded={picking}
                        className="inline-flex items-center gap-1.5 rounded-full border border-bd px-2.5 py-1 text-[13px] text-prt hover:border-pr">
                    <FiAtSign size={13} aria-hidden="true"/>{t("builder.message.mentionRole")}
                </button>
                {VARIABLES.map(v => (
                    <button key={v} type="button" onClick={() => insert(v)}
                            className="rounded-full bg-s2 px-2.5 py-1 font-mono text-xs text-mu hover:text-tx">{v}</button>
                ))}
                <span className="ml-auto text-xs tabular-nums text-mu">{value.length}/{MAX}</span>
            </div>
            {picking && (
                <Combobox autoFocus ariaLabel={t("builder.message.mentionRole")} placeholder={t("guildSettings.rolesSearch")}
                          emptyText={t("builder.access.noRoles")}
                          options={roles.map(r => ({value: r.id, label: r.name, dot: discordColor(r.color)}))}
                          onSelect={roleId => {
                              insert(`<@&${roleId}>`);
                              setPicking(false);
                          }}/>
            )}
        </div>
    );
}

function channelName(webhook: WebhookConfig, t: (key: string, o?: Record<string, string>) => string): string {
    return webhook.channelName
        ?? t("builder.hooks.unnamed", {id: webhook.url.match(/webhooks\/(\d+)/)?.[1]?.slice(-4) ?? ""});
}

/**
 * «Сообщение»: the text above the report in Discord — for every channel of
 * the form, and for each channel apart, — and each channel's embed.
 */
export default function MessageTab({guildId, guildName, formTitle, formSlug, reviewEnabled, fields, message, onMessage, webhooks, onWebhooks}: {
    guildId: string;
    guildName: string;
    formTitle: string;
    formSlug: string;
    reviewEnabled: boolean;
    fields: FormField[];
    message: string;
    onMessage: (message: string) => void;
    webhooks: WebhookConfig[];
    onWebhooks: (webhooks: WebhookConfig[]) => void;
}) {
    const {t} = useTranslation();
    const {user} = useAuth();
    const toast = useToast();
    const formId = useId();
    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [current, setCurrent] = useState(0);
    const index = Math.min(current, Math.max(webhooks.length - 1, 0));
    const webhook = webhooks[index];

    useEffect(() => {
        getGuildRoles(guildId).then(setRoles).catch(() => setRoles([]));
    }, [guildId]);

    const userName = user?.discordUsername || "dmitry";
    const vars: Record<string, string> = {
        "user.mention": "<@1>",
        "user.name": userName,
        "user.id": user?.id ?? "1",
        "form.title": formTitle,
        "form.url": formSlug ? `${window.location.origin}/f/${formSlug}` : "",
        "server.name": guildName,
        "status": t(`moderation.status.${reviewEnabled ? "PENDING" : "RECEIVED"}`),
        "date": new Date().toLocaleDateString("ru-RU"),
    };

    const change = (patch: Partial<WebhookConfig>) => onWebhooks(webhooks.map((w, i) => (i === index ? {...w, ...patch} : w)));
    const copyLook = () => {
        const look = Object.fromEntries(LOOK.map(k => [k, webhook[k]]));
        onWebhooks(webhooks.map((w, i) => (i === index ? w : {...w, ...look})));
        toast({tone: "success", text: t("builder.message.copied", {count: webhooks.length - 1})});
    };

    return (
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[22px] px-4 pb-10 pt-8 md:px-7">
            <div className="flex flex-col gap-1.5">
                <h1 className="m-0 text-[26px] font-bold">{t("builder.message.title")}</h1>
                <p className="m-0 text-[15px] text-mu">{t("builder.message.text")}</p>
            </div>

            <section className="flex flex-col gap-3 rounded-2xl border border-bd bg-sf p-5">
                <label htmlFor={formId} className="flex flex-col gap-1">
                    <span className="text-base font-semibold">{t("builder.message.formTitle")}</span>
                    <span className="text-[13px] text-mu">{t("builder.message.formHint")}</span>
                </label>
                <MessageBox id={formId} value={message} onChange={onMessage} roles={roles}
                            placeholder={t("builder.message.placeholder")}/>
            </section>

            {!webhook ? (
                <p className="m-0 rounded-2xl border border-dashed border-bd p-5 text-[13px] text-mu">{t("builder.message.noChannels")}</p>
            ) : (
                <section className="flex flex-col gap-4 rounded-2xl border border-bd bg-sf p-5">
                    <div className="flex flex-col gap-1">
                        <h2 className="m-0 text-base font-semibold">{t("builder.message.channelsTitle")}</h2>
                        <p className="m-0 text-[13px] text-mu">{t("builder.message.channelsHint")}</p>
                    </div>
                    <div role="tablist" aria-label={t("builder.message.channelsTitle")} className="flex flex-wrap gap-1.5">
                        {webhooks.map((w, i) => (
                            <button key={w.url || i} type="button" role="tab" aria-selected={i === index} onClick={() => setCurrent(i)}
                                    className={cx("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium",
                                        i === index ? "border-pr bg-prs text-prt" : "border-bd text-mu hover:text-tx")}>
                                <FiHash size={13} aria-hidden="true"/>{channelName(w, t)}
                                {(w.content?.trim() || LOOK.some(k => w[k] !== undefined && w[k] !== "" && w[k] !== null)) && (
                                    <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-pr" aria-label={t("builder.message.customized")}/>
                                )}
                            </button>
                        ))}
                    </div>

                    <div role="tabpanel" className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
                        <ChannelEditor key={index} webhook={webhook} roles={roles} onChange={change}
                                       onCopy={webhooks.length > 1 ? copyLook : undefined}/>
                        <div className="flex flex-col gap-2 lg:sticky lg:top-4">
                            <span className="text-[13px] font-semibold">{t("builder.message.previewTitle")}</span>
                            <DiscordPreview webhook={webhook} content={messageOf(message, webhook.content)} vars={vars}
                                            roles={roles} formTitle={formTitle} fields={fields}/>
                            <p className="m-0 text-xs text-mu">{t("builder.message.previewHint")}</p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

/** A group of the embed's settings; closed until opened, unless something in it is set. */
function Group({title, open, children}: { title: string; open: boolean; children: ReactNode }) {
    return (
        <details open={open} className="group rounded-[14px] border border-bd">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:hidden">
                <span className="mr-2 inline-block text-mu transition-transform group-open:rotate-90" aria-hidden="true">›</span>{title}
            </summary>
            <div className="flex flex-col gap-3 border-t border-bd px-4 pb-4 pt-3">{children}</div>
        </details>
    );
}

function LinkInput({label, value, onChange, hint}: { label: string; value: string | undefined; onChange: (v: string) => void; hint?: string }) {
    const {t} = useTranslation();
    const bad = !!value?.trim() && !isLink(value);
    return (
        <Field label={label} hint={hint} error={bad ? t("builder.message.badLink") : undefined}>
            <Input value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder="https://…" inputMode="url"/>
        </Field>
    );
}

function ChannelEditor({webhook, roles, onChange, onCopy}: {
    webhook: WebhookConfig;
    roles: DiscordRole[];
    onChange: (patch: Partial<WebhookConfig>) => void;
    onCopy?: () => void;
}) {
    const {t} = useTranslation();
    const textId = useId();
    const [hex, setHex] = useState(toHex(webhook.color));
    // Empty text is stored as absent: the server's defaults apply.
    const set = (key: keyof WebhookConfig) => (value: string) => onChange({[key]: value === "" ? undefined : value});
    const has = (...keys: (keyof WebhookConfig)[]) => keys.some(k => !!webhook[k]);

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-2">
                <label htmlFor={textId} className="text-sm font-semibold">
                    {t("builder.message.channelText", {channel: `#${channelName(webhook, t)}`})}
                </label>
                <MessageBox id={textId} value={webhook.content ?? ""} onChange={set("content")} roles={roles}
                            placeholder={t("builder.message.channelPlaceholder")}/>
            </div>

            <Group title={t("builder.message.groups.embed")} open>
                <div className="flex flex-wrap items-end gap-3">
                    <Field label={t("builder.message.color")} className="w-[170px]">
                        <Input value={hex} maxLength={7} className="font-mono"
                               onChange={e => {
                                   setHex(e.target.value);
                                   const n = fromHex(e.target.value);
                                   if (n !== null) onChange({color: n});
                               }}/>
                    </Field>
                    <input type="color" aria-label={t("builder.message.color")} value={toHex(webhook.color)}
                           onChange={e => {
                               setHex(e.target.value);
                               onChange({color: fromHex(e.target.value) ?? DEFAULT_COLOR});
                           }}
                           className="h-10 w-12 cursor-pointer rounded-[10px] border border-bd bg-sf p-1"/>
                    {webhook.color !== undefined && webhook.color !== null && (
                        <Button variant="ghost" size="sm" onClick={() => {
                            setHex(toHex(undefined));
                            onChange({color: undefined});
                        }}>{t("builder.message.resetColor")}</Button>
                    )}
                </div>
                <Field label={t("builder.message.embedTitle")}>
                    <Input value={webhook.embedTitle ?? ""} maxLength={256} onChange={e => set("embedTitle")(e.target.value)}
                           placeholder={t("builder.message.embedTitlePlaceholder")}/>
                </Field>
                <LinkInput label={t("builder.message.titleUrl")} value={webhook.titleUrl} onChange={set("titleUrl")}/>
                <Field label={t("builder.message.description")}>
                    <Textarea value={webhook.embedDescription ?? ""} maxLength={4096} rows={3}
                              onChange={e => set("embedDescription")(e.target.value)}
                              placeholder={t("builder.message.descriptionPlaceholder")}/>
                </Field>
                <Switch checked={!!webhook.fieldsInline} onChange={v => onChange({fieldsInline: v || undefined})}
                        label={t("builder.message.fieldsInline")}/>
            </Group>

            <Group title={t("builder.message.groups.author")} open={has("authorName", "authorIconUrl", "authorUrl")}>
                <Field label={t("builder.message.authorName")}>
                    <Input value={webhook.authorName ?? ""} maxLength={256} onChange={e => set("authorName")(e.target.value)}
                           placeholder={t("builder.message.authorNamePlaceholder")}/>
                </Field>
                <LinkInput label={t("builder.message.authorIconUrl")} value={webhook.authorIconUrl} onChange={set("authorIconUrl")}/>
                <LinkInput label={t("builder.message.authorUrl")} value={webhook.authorUrl} onChange={set("authorUrl")}/>
            </Group>

            <Group title={t("builder.message.groups.images")} open={has("thumbnailUrl", "imageUrl")}>
                <LinkInput label={t("builder.message.thumbnailUrl")} value={webhook.thumbnailUrl} onChange={set("thumbnailUrl")}
                           hint={t("builder.message.thumbnailHint")}/>
                <LinkInput label={t("builder.message.imageUrl")} value={webhook.imageUrl} onChange={set("imageUrl")}
                           hint={t("builder.message.imageHint")}/>
            </Group>

            <Group title={t("builder.message.groups.footer")} open={has("footerText", "footerIconUrl") || webhook.timestamp === false}>
                <Field label={t("builder.message.footerText")}>
                    <Input value={webhook.footerText ?? ""} maxLength={2048} onChange={e => set("footerText")(e.target.value)}
                           placeholder={t("builder.message.footerPlaceholder")}/>
                </Field>
                <LinkInput label={t("builder.message.footerIconUrl")} value={webhook.footerIconUrl} onChange={set("footerIconUrl")}
                           hint={t("builder.message.footerIconHint")}/>
                <Switch checked={webhook.timestamp !== false} onChange={v => onChange({timestamp: v ? undefined : false})}
                        label={t("builder.message.timestamp")}/>
            </Group>

            <Group title={t("builder.message.groups.sender")} open={has("botName", "avatarUrl")}>
                <Field label={t("builder.message.botName")} hint={t("builder.message.botNameHint", {name: DEFAULT_SENDER})}>
                    <Input value={webhook.botName ?? ""} maxLength={80} onChange={e => set("botName")(e.target.value)}
                           placeholder={DEFAULT_SENDER}/>
                </Field>
                <LinkInput label={t("builder.message.avatarUrl")} value={webhook.avatarUrl} onChange={set("avatarUrl")}/>
            </Group>

            {onCopy && (
                <Button variant="secondary" size="sm" icon={<FiCopy size={14} aria-hidden="true"/>} onClick={onCopy} className="self-start">
                    {t("builder.message.copyLook")}
                </Button>
            )}
        </div>
    );
}
