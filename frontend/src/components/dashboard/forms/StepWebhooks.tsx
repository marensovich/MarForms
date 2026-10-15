import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {
    FiAlertCircle,
    FiCheck,
    FiChevronDown,
    FiChevronUp,
    FiHash,
    FiImage,
    FiLink,
    FiLoader,
    FiPlus,
    FiTrash2,
    FiUser,
    FiZap,
} from "react-icons/fi";
import type {FormDraft} from "./FormWizard";
import type {WebhookConfig} from "../../../types/forms";
import {type DiscordChannel, createGuildWebhook, getGuildChannels} from "../../../api/dashboard";
import WebhookHealthNotice from "./WebhookHealthNotice";

interface Props {
    draft: FormDraft;
    onChange: (patch: Partial<FormDraft>) => void;
}

// Same rule as the server (DiscordWebhookUrl), which rejects anything else.
const DISCORD_WEBHOOK_RE =
    /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api(?:\/v\d{1,2})?\/webhooks\/\d{1,25}\/[\w-]{1,256}\/?$/;

const COLOR_PRESETS = [
    {label: "Blurple", hex: "#5865F2", value: 5793266},
    {label: "Green", hex: "#57F287", value: 5763719},
    {label: "Red", hex: "#ED4245", value: 15548997},
    {label: "Gold", hex: "#F1C40F", value: 15844367},
    {label: "Cyan", hex: "#1ABC9C", value: 1752220},
];

function hexToInt(hex: string): number | undefined {
    const clean = hex.replace("#", "");
    const n = parseInt(clean, 16);
    return isNaN(n) ? undefined : n;
}

function intToHex(n: number): string {
    return "#" + n.toString(16).padStart(6, "0").toUpperCase();
}

function empty(): WebhookConfig {
    return {url: ""};
}

// ── Shared input styles ────────────────────────────────────────────────────────

function inputCls(hasError?: boolean) {
    return `w-full rounded-xl border px-3 py-2 text-sm text-tx placeholder-mu/70 outline-none transition-colors focus:ring-1 ${
        hasError
            ? "border-rdb bg-rdb focus:border-rdt focus:ring-rdt/20"
            : "border-bd bg-bg focus:border-pr focus:ring-pr/20"
    }`;
}

// ── Section label within the card ─────────────────────────────────────────────

function Group({label, icon, children}: {
    label: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="mt-4 first:mt-0">
            <div className="mb-2.5 flex items-center gap-1.5">
                <span className="text-mu/70">{icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-mu">{label}</span>
            </div>
            <div className="flex flex-col gap-2.5">
                {children}
            </div>
        </div>
    );
}

function Row({children}: { children: React.ReactNode }) {
    return <div className="grid grid-cols-2 gap-2.5">{children}</div>;
}

function Field({label, hint, children}: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-mu">
                {label}
                {hint && <span className="ml-1.5 text-mu/70 font-normal">{hint}</span>}
            </span>
            {children}
        </label>
    );
}

// ── Webhook card ───────────────────────────────────────────────────────────────

// A new URL is a different webhook: its old delivery status no longer applies.
const CLEARED_HEALTH: Partial<WebhookConfig> = {invalid: null, health: null, healthReason: null, lastError: null};

function WebhookCard({wh, guildId, channels, channelsLoading, onUpdate, onDelete}: {
    wh: WebhookConfig;
    guildId: string;
    channels: DiscordChannel[];
    channelsLoading: boolean;
    onUpdate: (patch: Partial<WebhookConfig>) => void;
    onDelete: () => void;
}) {
    const {t} = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [hexInput, setHexInput] = useState(wh.color != null ? intToHex(wh.color) : "");
    const [selectedChannel, setSelectedChannel] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const urlValid = !wh.url || DISCORD_WEBHOOK_RE.test(wh.url.trim());

    const handleCreateFromChannel = async () => {
        if (!selectedChannel) return;
        setCreating(true);
        setCreateError(null);
        try {
            const {url} = await createGuildWebhook(guildId, selectedChannel);
            onUpdate({url, ...CLEARED_HEALTH});
        } catch (e) {
            setCreateError(e instanceof Error ? e.message : t("wizard.webhooks.createFailed"));
        } finally {
            setCreating(false);
        }
    };

    const handleHexChange = (val: string) => {
        setHexInput(val);
        onUpdate({color: hexToInt(val)});
    };

    const selectPreset = (value: number, hex: string) => {
        setHexInput(hex);
        onUpdate({color: value});
    };

    const str = (v: string | undefined) => v ?? "";

    return (
        <div className="overflow-hidden rounded-xl border border-bd bg-sf">
            <WebhookHealthNotice webhook={wh}/>

            {/* Create-from-channel row (bot-managed) */}
            {guildId && (
                <div className="flex flex-wrap items-center gap-2 border-b border-bd bg-bg px-4 py-3">
                    <FiHash size={12} className="flex-shrink-0 text-mu"/>
                    <span className="text-xs font-medium text-mu">{t("wizard.webhooks.createFromChannel")}</span>
                    <select
                        value={selectedChannel}
                        onChange={e => setSelectedChannel(e.target.value)}
                        disabled={channelsLoading || channels.length === 0}
                        className="min-w-[160px] flex-1 rounded-lg border border-bd bg-sf px-2.5 py-1.5 text-xs text-tx outline-none focus:border-pr disabled:text-mu/70"
                    >
                        <option value="">
                            {channelsLoading
                                ? t("wizard.webhooks.loadingChannels")
                                : channels.length === 0
                                    ? t("wizard.webhooks.noChannelsFound")
                                    : t("wizard.webhooks.selectChannel")}
                        </option>
                        {channels.map(c => (
                            <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={handleCreateFromChannel}
                        disabled={!selectedChannel || creating}
                        className="flex items-center gap-1.5 rounded-lg bg-pr px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-prh disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {creating ? <FiLoader size={11} className="animate-spin"/> : <FiZap size={11}/>}
                        {t("wizard.webhooks.createButton")}
                    </button>
                    {createError && (
                        <p className="flex w-full items-center gap-1 text-[11px] text-rdt">
                            <FiAlertCircle size={10}/> {createError}
                        </p>
                    )}
                </div>
            )}

            {/* Header row */}
            <div className="flex items-center gap-3 p-4">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-prs">
                    <FiLink size={13} className="text-prt"/>
                </div>
                <div className="min-w-0 flex-1">
                    <input
                        type="url"
                        value={wh.url}
                        onChange={e => onUpdate({url: e.target.value, ...CLEARED_HEALTH})}
                        placeholder={t("wizard.webhooks.urlPlaceholder")}
                        className={inputCls(!urlValid && wh.url.length > 0)}
                    />
                    {!urlValid && wh.url.length > 0 ? (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-rdt">
                            <FiAlertCircle size={10}/> {t("wizard.webhooks.invalidUrl")}
                        </p>
                    ) : guildId && (
                        <p className="mt-1 text-[11px] text-mu/70">{t("wizard.webhooks.orPasteManually")}</p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setExpanded(e => !e)}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-mu transition-colors hover:bg-s2 hover:text-tx"
                    title="Configure embed"
                >
                    {expanded ? <FiChevronUp size={14}/> : <FiChevronDown size={14}/>}
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-mu/70 transition-colors hover:bg-rdb hover:text-rdt"
                    title="Remove webhook"
                >
                    <FiTrash2 size={13}/>
                </button>
            </div>

            {/* Expanded embed builder */}
            {expanded && (
                <div className="border-t border-bd px-4 pb-5 pt-4">

                    {/* ── Variables reference ────────────────────────── */}
                    <div className="rounded-lg border border-prs bg-prs px-3 py-2.5">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-prt">
                            {t("wizard.webhooks.availableVars")}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {([
                                ["{username}", "Discord username"],
                                ["{user_id}", "Discord ID"],
                                ["{user_mention}", "<@ID> ping"],
                                ["{form_title}", "form name"],
                                ["{form_id}", "form UUID"],
                                ["{submission_id}", "submission UUID"],
                                ["{timestamp}", "Discord timestamp"],
                                ["{date}", "yyyy-MM-dd"],
                                ["{time}", "HH:mm:ss"],
                                ["{server_id}", "guild ID"],
                            ] as [string, string][]).map(([v, hint]) => (
                                <span key={v} title={hint}
                                      className="cursor-default rounded border border-prs bg-sf px-1.5 py-0.5 font-mono text-[10px] text-prt">
                                    {v}
                                </span>
                            ))}
                        </div>
                        <p className="mt-1.5 text-[10px] text-mu">
                            {t("wizard.webhooks.varHint")}
                        </p>
                    </div>

                    {/* ── Message ─────────────────────────────────────── */}
                    <Group label={t("wizard.webhooks.groups.message")} icon={<FiLink size={11}/>}>
                        <Row>
                            <Field label={t("wizard.webhooks.fields.botName")}>
                                <input type="text" value={str(wh.botName)}
                                       onChange={e => onUpdate({botName: e.target.value || undefined})}
                                       placeholder="MarForms" className={inputCls()}/>
                            </Field>
                            <Field label={t("wizard.webhooks.fields.avatarUrl")}>
                                <input type="url" value={str(wh.avatarUrl)}
                                       onChange={e => onUpdate({avatarUrl: e.target.value || undefined})}
                                       placeholder="https://…/avatar.png" className={inputCls()}/>
                            </Field>
                        </Row>
                        <Field label={t("wizard.webhooks.fields.content")} hint={t("wizard.webhooks.fields.contentHint")}>
                            <input type="text" value={str(wh.content)}
                                   onChange={e => onUpdate({content: e.target.value || undefined})}
                                   placeholder="New submission received" className={inputCls()}/>
                        </Field>
                    </Group>

                    {/* ── Embed: Header ──────────────────────────────── */}
                    <Group label={t("wizard.webhooks.groups.embedHeader")} icon={<FiLink size={11}/>}>
                        <Field label={t("wizard.webhooks.fields.embedTitle")} hint={t("wizard.webhooks.fields.embedTitleHint")}>
                            <input type="text" value={str(wh.embedTitle)}
                                   onChange={e => onUpdate({embedTitle: e.target.value || undefined})}
                                   placeholder="Form submission" className={inputCls()}/>
                        </Field>
                        <Field label={t("wizard.webhooks.fields.embedDesc")}>
                            <textarea value={str(wh.embedDescription)}
                                      onChange={e => onUpdate({embedDescription: e.target.value || undefined})}
                                      placeholder="Optional text below the title — supports **markdown**"
                                      rows={2} className={`${inputCls()} resize-none`}/>
                        </Field>

                        {/* Color picker */}
                        <div>
                            <span className="text-[11px] font-medium text-mu">{t("wizard.webhooks.fields.embedColor")}</span>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                {COLOR_PRESETS.map(p => {
                                    const active = wh.color === p.value;
                                    return (
                                        <button key={p.value} type="button"
                                                onClick={() => selectPreset(p.value, p.hex)}
                                                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                                                    active
                                                        ? "border-bd bg-s2 text-tx"
                                                        : "border-bd bg-sf text-mu hover:text-tx"
                                                }`}>
                                            <span className="h-3 w-3 rounded-full" style={{background: p.hex}}/>
                                            {p.label}
                                            {active && <FiCheck size={10}/>}
                                        </button>
                                    );
                                })}
                                <div
                                    className="flex items-center gap-1.5 rounded-lg border border-bd bg-sf px-2.5 py-1">
                                    <span className="text-xs text-mu">HEX</span>
                                    <input type="text" value={hexInput}
                                           onChange={e => handleHexChange(e.target.value)}
                                           placeholder="#5865F2" maxLength={7}
                                           className="w-20 bg-transparent text-xs text-tx outline-none placeholder-mu/70"/>
                                </div>
                            </div>
                        </div>
                    </Group>

                    {/* ── Embed: Author ──────────────────────────────── */}
                    <Group label={t("wizard.webhooks.groups.embedAuthor")} icon={<FiUser size={11}/>}>
                        <Field label={t("wizard.webhooks.fields.authorName")} hint={t("wizard.webhooks.fields.authorNameHint")}>
                            <input type="text" value={str(wh.authorName)}
                                   onChange={e => onUpdate({authorName: e.target.value || undefined})}
                                   placeholder="Submitted by {username}" className={inputCls()}/>
                        </Field>
                        <Row>
                            <Field label={t("wizard.webhooks.fields.authorIconUrl")} hint={t("wizard.webhooks.fields.authorIconHint")}>
                                <input type="url" value={str(wh.authorIconUrl)}
                                       onChange={e => onUpdate({authorIconUrl: e.target.value || undefined})}
                                       placeholder="https://…/icon.png" className={inputCls()}/>
                            </Field>
                            <Field label={t("wizard.webhooks.fields.authorUrl")} hint={t("wizard.webhooks.fields.authorUrlHint")}>
                                <input type="url" value={str(wh.authorUrl)}
                                       onChange={e => onUpdate({authorUrl: e.target.value || undefined})}
                                       placeholder="https://…" className={inputCls()}/>
                            </Field>
                        </Row>
                    </Group>

                    {/* ── Embed: Images ──────────────────────────────── */}
                    <Group label={t("wizard.webhooks.groups.embedImages")} icon={<FiImage size={11}/>}>
                        <Row>
                            <Field label={t("wizard.webhooks.fields.thumbnailUrl")} hint={t("wizard.webhooks.fields.thumbnailHint")}>
                                <input type="url" value={str(wh.thumbnailUrl)}
                                       onChange={e => onUpdate({thumbnailUrl: e.target.value || undefined})}
                                       placeholder="https://…/thumb.png" className={inputCls()}/>
                            </Field>
                            <Field label={t("wizard.webhooks.fields.imageUrl")} hint={t("wizard.webhooks.fields.imageHint")}>
                                <input type="url" value={str(wh.imageUrl)}
                                       onChange={e => onUpdate({imageUrl: e.target.value || undefined})}
                                       placeholder="https://…/banner.png" className={inputCls()}/>
                            </Field>
                        </Row>
                    </Group>

                    {/* ── Embed: Fields display ──────────────────────── */}
                    <Group label={t("wizard.webhooks.groups.embedFields")} icon={<FiLink size={11}/>}>
                        <label className="flex cursor-pointer items-center gap-2.5 select-none">
                            <div
                                onClick={() => onUpdate({fieldsInline: !wh.fieldsInline})}
                                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                                    wh.fieldsInline
                                        ? "border-pr bg-prs"
                                        : "border-bd bg-sf hover:border-bd"
                                }`}
                            >
                                {wh.fieldsInline && <div className="h-2 w-2 rounded-sm bg-pr"/>}
                            </div>
                            <span className="text-xs text-mu">
                                {t("wizard.webhooks.fields.inlineFields")}
                                <span className="ml-1.5 text-mu">{t("wizard.webhooks.fields.inlineFieldsHint")}</span>
                            </span>
                        </label>
                    </Group>
                </div>
            )}
        </div>
    );
}

// ── Step root ─────────────────────────────────────────────────────────────────

export default function StepWebhooks({draft, onChange}: Props) {
    const {t} = useTranslation();
    const webhooks = draft.webhooks;
    const guildId = draft.serverId.trim();

    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [channelsLoading, setChannelsLoading] = useState(false);

    useEffect(() => {
        if (!guildId) {
            setChannels([]);
            return;
        }
        let cancelled = false;
        setChannelsLoading(true);
        getGuildChannels(guildId)
            .then(result => {
                if (!cancelled) setChannels(result);
            })
            .catch(() => {
                if (!cancelled) setChannels([]);
            })
            .finally(() => {
                if (!cancelled) setChannelsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [guildId]);

    const update = (index: number, patch: Partial<WebhookConfig>) => {
        const next = webhooks.map((w, i) => (i === index ? {...w, ...patch} : w));
        onChange({webhooks: next});
    };

    const remove = (index: number) => {
        onChange({webhooks: webhooks.filter((_, i) => i !== index)});
    };

    const add = () => {
        onChange({webhooks: [...webhooks, empty()]});
    };

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h3 className="text-sm font-semibold text-tx">{t("wizard.webhooks.title")}</h3>
                <p className="mt-1 text-sm text-mu">
                    {t("wizard.webhooks.subtitle")}
                </p>
            </div>

            {webhooks.length > 0 && (
                <div className="flex flex-col gap-2">
                    {webhooks.map((wh, i) => (
                        <WebhookCard
                            key={i}
                            wh={wh}
                            guildId={guildId}
                            channels={channels}
                            channelsLoading={channelsLoading}
                            onUpdate={patch => update(i, patch)}
                            onDelete={() => remove(i)}
                        />
                    ))}
                </div>
            )}

            {webhooks.length === 0 && (
                <div className="rounded-xl border border-dashed border-bd py-8 text-center">
                    <FiLink size={20} className="mx-auto mb-2 text-mu/70"/>
                    <p className="text-sm text-mu">{t("wizard.webhooks.noWebhooks")}</p>
                    <p className="mt-0.5 text-xs text-mu/70">{t("wizard.webhooks.clickToAdd")}</p>
                </div>
            )}

            <button
                type="button"
                onClick={add}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-prs py-2.5 text-sm text-prt transition-colors hover:border-pr hover:bg-prs"
            >
                <FiPlus size={14}/>
                {t("wizard.webhooks.addWebhook")}
            </button>
        </div>
    );
}
