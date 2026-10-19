import {useEffect, useId, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiAtSign, FiHash} from "react-icons/fi";
import {type DiscordRole, getGuildRoles} from "../../api/dashboard";
import type {WebhookConfig} from "../../types/forms";
import {Combobox, discordColor} from "../../ui";

// Not in the mockups: the owner's answer of 2026-10-19 — a report is sent to
// Discord as is, and a text can go above it: the form's own for every channel,
// then each channel's (role mentions and the like).

const MAX = 2000;
const VARIABLES = ["{user.mention}", "{user.name}", "{form.title}", "{form.url}", "{server.name}", "{date}"];

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

    // Shown as the reader will see it: <@&id> as @Role.
    const preview = value.replace(/<@&(\d+)>/g, (_, roleId: string) => `@${roles.find(r => r.id === roleId)?.name ?? roleId}`);

    return (
        <div className="flex flex-col gap-2">
            <textarea id={id} ref={area} value={value} maxLength={MAX} rows={4} placeholder={placeholder}
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
            {value.includes("<@&") && (
                <p className="m-0 rounded-[10px] bg-s2 px-3 py-2 text-[13px] text-mu">
                    <span className="font-semibold text-tx">{t("builder.message.preview")}</span> {preview}
                </p>
            )}
        </div>
    );
}

/**
 * «Сообщение»: the text above the report in Discord — for every channel of
 * the form, and for each channel apart. The form's comes first.
 */
export default function MessageTab({guildId, message, onMessage, webhooks, onWebhooks}: {
    guildId: string;
    message: string;
    onMessage: (message: string) => void;
    webhooks: WebhookConfig[];
    onWebhooks: (webhooks: WebhookConfig[]) => void;
}) {
    const {t} = useTranslation();
    const formId = useId();
    const [roles, setRoles] = useState<DiscordRole[]>([]);

    useEffect(() => {
        getGuildRoles(guildId).then(setRoles).catch(() => setRoles([]));
    }, [guildId]);

    return (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-[22px] px-4 pb-10 pt-8 md:px-7">
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

            <section className="flex flex-col gap-3 rounded-2xl border border-bd bg-sf p-5">
                <div className="flex flex-col gap-1">
                    <h2 className="m-0 text-base font-semibold">{t("builder.message.channelsTitle")}</h2>
                    <p className="m-0 text-[13px] text-mu">{t("builder.message.channelsHint")}</p>
                </div>
                {webhooks.length === 0 ? (
                    <p className="m-0 text-[13px] text-mu">{t("builder.message.noChannels")}</p>
                ) : webhooks.map((w, i) => (
                    <ChannelMessage key={w.url || i} webhook={w} roles={roles}
                                    onChange={content => onWebhooks(webhooks.map((x, j) => (j === i ? {...x, content} : x)))}/>
                ))}
            </section>
        </div>
    );
}

function ChannelMessage({webhook, roles, onChange}: {
    webhook: WebhookConfig;
    roles: DiscordRole[];
    onChange: (content: string) => void;
}) {
    const {t} = useTranslation();
    const id = useId();
    const name = webhook.channelName
        ? `#${webhook.channelName}`
        : t("builder.hooks.unnamed", {id: webhook.url.match(/webhooks\/(\d+)/)?.[1]?.slice(-4) ?? ""});
    return (
        <div className="flex flex-col gap-2 rounded-[14px] bg-s2 p-4">
            <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-semibold">
                <FiHash size={14} aria-hidden="true" className="text-mu"/>{name.replace(/^#/, "")}
            </label>
            <MessageBox id={id} value={webhook.content ?? ""} onChange={onChange} roles={roles}
                        placeholder={t("builder.message.channelPlaceholder")}/>
        </div>
    );
}
