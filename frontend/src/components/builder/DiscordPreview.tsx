import {useState} from "react";
import {useTranslation} from "react-i18next";
import type {DiscordRole} from "../../api/dashboard";
import type {FormField, WebhookConfig} from "../../types/forms";
import {isInputField} from "../../types/forms";
import {cx, discordColor} from "../../ui";
import {DEFAULT_SENDER, fill, isLink, pieces, toHex} from "./discordMessage";

// Drawn in Discord's own dark theme whatever the site's: it is how the
// channel will show the report.

/** Text with mentions as Discord's chips. */
function Rich({text, roles, userName}: { text: string; roles: DiscordRole[]; userName: string }) {
    return (
        <>
            {pieces(text).map((p, i) => {
                if ("text" in p) return <span key={i}>{p.text}</span>;
                if ("user" in p) return <span key={i} className="rounded-[3px] bg-[#5865f24d] px-0.5 font-medium text-[#c9cdfb]">@{userName}</span>;
                const role = roles.find(r => r.id === p.role);
                const color = role?.color ? discordColor(role.color) : "#c9cdfb";
                return (
                    <span key={i} className="rounded-[3px] px-0.5 font-medium"
                          style={{color, background: role?.color ? `${color}26` : "#5865f24d"}}>@{role?.name ?? p.role}</span>
                );
            })}
        </>
    );
}

/** An image of the embed; a link that does not load shows nothing, as in Discord. */
function Img({src, className, alt = ""}: { src: string | undefined; className: string; alt?: string }) {
    const [broken, setBroken] = useState<string | null>(null);
    if (!isLink(src) || broken === src) return null;
    return <img src={src} alt={alt} className={className} onError={() => setBroken(src)}/>;
}

/** An answer as an example: the first option, or a placeholder of the type. */
function sample(field: FormField, t: (key: string) => string): string {
    if (field.options?.length) return field.options[0];
    if (field.type === "BOOLEAN" || field.type === "CHECKBOX") return t("builder.message.sample.yes");
    if (field.type === "NUMBER" || field.type === "RATING") return "5";
    if (field.type === "DATE" || field.type === "DATETIME") return new Date().toLocaleDateString("ru-RU");
    return field.placeholder?.trim() || t("builder.message.sample.text");
}

export default function DiscordPreview({webhook, content, vars, roles, formTitle, fields}: {
    webhook: WebhookConfig;
    /** The text above the report, before the variables are filled. */
    content: string;
    vars: Record<string, string>;
    roles: DiscordRole[];
    formTitle: string;
    fields: FormField[];
}) {
    const {t, i18n} = useTranslation();
    const userName = vars["user.name"];
    const now = new Date().toLocaleTimeString(i18n.language, {hour: "2-digit", minute: "2-digit"});
    const today = t("builder.message.today", {time: now});
    const sender = webhook.botName?.trim() || DEFAULT_SENDER;
    const color = toHex(webhook.color);
    const title = fill(webhook.embedTitle?.trim() || formTitle || t("builder.message.untitled"), vars);
    const author = webhook.authorName?.trim() ? fill(webhook.authorName, vars) : t("builder.message.defaultAuthor", {name: userName});
    const description = webhook.embedDescription?.trim() ? fill(webhook.embedDescription, vars) : "";
    const footer = webhook.footerText?.trim() ? fill(webhook.footerText, vars) : "";
    const showTime = webhook.timestamp !== false;
    const answers = fields.filter(isInputField).filter(f => f.label.trim());
    const inline = !!webhook.fieldsInline;

    return (
        <figure aria-label={t("builder.message.previewTitle")}
                className="m-0 rounded-2xl bg-[#313338] p-4 font-sans text-[15px] leading-[1.375] text-[#dbdee1]">
            <div className="flex gap-4">
                {isLink(webhook.avatarUrl)
                    ? <Img src={webhook.avatarUrl} className="h-10 w-10 flex-none rounded-full object-cover"/>
                    : <span aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#5865f2] text-sm font-bold text-white">{sender.slice(0, 1).toUpperCase()}</span>}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-white">{sender}</span>
                        <span className="rounded-[3px] bg-[#5865f2] px-1 text-[10px] font-semibold leading-4 text-white">{t("builder.message.app")}</span>
                        <span className="text-xs text-[#949ba4]">{today}</span>
                    </div>
                    {content && (
                        <p className="m-0 whitespace-pre-wrap break-words">
                            <Rich text={fill(content, vars)} roles={roles} userName={userName}/>
                        </p>
                    )}
                    <div className="mt-1 grid max-w-[520px] rounded-[4px] border-l-4 bg-[#2b2d31]" style={{borderLeftColor: color}}>
                        <div className="flex gap-4 py-2 pl-3 pr-4">
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <Img src={webhook.authorIconUrl} className="h-6 w-6 rounded-full object-cover"/>
                                    <span className={cx(isLink(webhook.authorUrl) && "hover:underline")}>{author}</span>
                                </div>
                                <div className={cx("break-words font-semibold", isLink(webhook.titleUrl) ? "text-[#00a8fc]" : "text-white")}>{title}</div>
                                {description && (
                                    <div className="whitespace-pre-wrap break-words text-sm">
                                        <Rich text={description} roles={roles} userName={userName}/>
                                    </div>
                                )}
                                {answers.length > 0 && (
                                    <div className={cx("grid gap-2", inline ? "grid-cols-3" : "grid-cols-1")}>
                                        {answers.map(f => (
                                            <div key={f.id} className="min-w-0 text-sm">
                                                <div className="break-words font-semibold text-white">{f.label}</div>
                                                <div className="break-words">{sample(f, t)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Img src={webhook.imageUrl} className="mt-2 max-h-[300px] w-full rounded-[4px] object-cover"/>
                                {(footer || showTime) && (
                                    <div className="flex items-center gap-2 text-xs text-[#949ba4]">
                                        {footer && <Img src={webhook.footerIconUrl} className="h-5 w-5 rounded-full object-cover"/>}
                                        <span>{[footer, showTime ? today : ""].filter(Boolean).join(" • ")}</span>
                                    </div>
                                )}
                            </div>
                            <Img src={webhook.thumbnailUrl} className="h-20 w-20 flex-none rounded-[4px] object-cover"/>
                        </div>
                    </div>
                </div>
            </div>
        </figure>
    );
}
