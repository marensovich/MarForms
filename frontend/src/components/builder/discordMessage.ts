// What a report looks like in Discord, for the «Сообщение» preview: the same
// text and embed WebhookService builds, filled with an example respondent.

/** Discord's blurple, the embed's colour when none is set (WebhookService.DEFAULT_COLOR). */
export const DEFAULT_COLOR = 0x5865f2;
/** The name Discord shows when the bot created the webhook and no name is set. */
export const DEFAULT_SENDER = "MarForms";
const MAX = 2000;

export function toHex(color: number | undefined): string {
    return `#${(color ?? DEFAULT_COLOR).toString(16).padStart(6, "0")}`;
}

/** "#RRGGBB" (or without "#") → the number Discord takes; null if it is not one. */
export function fromHex(value: string): number | null {
    const m = value.trim().match(/^#?([0-9a-f]{6})$/i);
    return m ? parseInt(m[1], 16) : null;
}

/** The text above the report: the form's, then the channel's (WebhookService.messageOf). */
export function messageOf(form: string, channel: string | undefined): string {
    const text = [form, channel ?? ""].filter(s => s.trim()).map(s => s.trim()).join("\n");
    return text.length > MAX ? text.slice(0, MAX) : text;
}

/** Puts the values in place of {name}; an unknown variable stays as written, as on the server. */
export function fill(template: string, vars: Record<string, string>): string {
    return template.replace(/\{([\w.]+)\}/g, (all, name: string) => vars[name] ?? all);
}

export type Piece = { text: string } | { role: string } | { user: string };

/** Splits text at role and user mentions, which Discord draws as chips. */
export function pieces(text: string): Piece[] {
    const out: Piece[] = [];
    let at = 0;
    for (const m of text.matchAll(/<@&(\d+)>|<@!?(\d+)>/g)) {
        if (m.index > at) out.push({text: text.slice(at, m.index)});
        out.push(m[1] ? {role: m[1]} : {user: m[2]});
        at = m.index + m[0].length;
    }
    if (at < text.length) out.push({text: text.slice(at)});
    return out;
}

/** A link Discord would load: the server refuses others on save. */
export function isLink(value: string | undefined): value is string {
    return !!value && /^https?:\/\/\S+$/.test(value.trim());
}
