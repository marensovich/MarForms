import {useState} from "react";
import {FiAlertCircle, FiCheck, FiChevronDown, FiChevronUp, FiLink, FiPlus, FiTrash2,} from "react-icons/fi";
import type {FormDraft} from "./FormWizard";
import type {WebhookConfig} from "../../../types/forms";

interface Props {
    draft: FormDraft;
    onChange: (patch: Partial<FormDraft>) => void;
}

const DISCORD_WEBHOOK_RE =
    /^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/.+$/;

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

function WebhookCard({
                         wh,
                         index,
                         onUpdate,
                         onDelete,
                     }: {
    wh: WebhookConfig;
    index: number;
    onUpdate: (patch: Partial<WebhookConfig>) => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [hexInput, setHexInput] = useState(wh.color != null ? intToHex(wh.color) : "");

    const urlValid = !wh.url || DISCORD_WEBHOOK_RE.test(wh.url);

    const inputCls = (hasError?: boolean) =>
        `w-full rounded-xl border px-3 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors focus:ring-1 ${
            hasError
                ? "border-red-500/50 bg-red-500/[0.04] focus:border-red-500/60 focus:ring-red-500/20"
                : "border-white/[0.08] bg-white/[0.04] focus:border-indigo-500/60 focus:ring-indigo-500/30"
        }`;

    const handleHexChange = (val: string) => {
        setHexInput(val);
        const n = hexToInt(val);
        onUpdate({color: n});
    };

    const selectPreset = (value: number, hex: string) => {
        setHexInput(hex);
        onUpdate({color: value});
    };

    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
            {/* Card header */}
            <div className="flex items-center gap-3 p-4">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/15">
                    <FiLink size={13} className="text-indigo-400"/>
                </div>
                <div className="min-w-0 flex-1">
                    <input
                        type="url"
                        value={wh.url}
                        onChange={e => onUpdate({url: e.target.value})}
                        placeholder="https://discord.com/api/webhooks/…"
                        className={inputCls(!urlValid && wh.url.length > 0)}
                    />
                    {!urlValid && wh.url.length > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                            <FiAlertCircle size={10}/> Not a valid Discord webhook URL
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setExpanded(e => !e)}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white"
                    title="Configure"
                >
                    {expanded ? <FiChevronUp size={14}/> : <FiChevronDown size={14}/>}
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Remove webhook"
                >
                    <FiTrash2 size={13}/>
                </button>
            </div>

            {/* Expanded settings */}
            {expanded && (
                <div className="border-t border-white/[0.06] px-4 pb-4 pt-4">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-medium text-white/45">Bot name</span>
                            <input
                                type="text"
                                value={wh.botName ?? ""}
                                onChange={e => onUpdate({botName: e.target.value || undefined})}
                                placeholder="MarForms"
                                className={inputCls()}
                            />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-medium text-white/45">Avatar URL</span>
                            <input
                                type="url"
                                value={wh.avatarUrl ?? ""}
                                onChange={e => onUpdate({avatarUrl: e.target.value || undefined})}
                                placeholder="https://…/avatar.png"
                                className={inputCls()}
                            />
                        </label>
                    </div>

                    <label className="mt-3 flex flex-col gap-1.5">
                        <span className="text-[11px] font-medium text-white/45">Content (text above embed)</span>
                        <input
                            type="text"
                            value={wh.content ?? ""}
                            onChange={e => onUpdate({content: e.target.value || undefined})}
                            placeholder="New submission received"
                            className={inputCls()}
                        />
                    </label>

                    <label className="mt-3 flex flex-col gap-1.5">
                        <span className="text-[11px] font-medium text-white/45">Embed title override</span>
                        <input
                            type="text"
                            value={wh.embedTitle ?? ""}
                            onChange={e => onUpdate({embedTitle: e.target.value || undefined})}
                            placeholder="Defaults to form title"
                            className={inputCls()}
                        />
                    </label>

                    <label className="mt-3 flex flex-col gap-1.5">
                        <span className="text-[11px] font-medium text-white/45">Embed description</span>
                        <textarea
                            value={wh.embedDescription ?? ""}
                            onChange={e => onUpdate({embedDescription: e.target.value || undefined})}
                            placeholder="Optional text below the title"
                            rows={2}
                            className={`${inputCls()} resize-none`}
                        />
                    </label>

                    {/* Color */}
                    <div className="mt-3">
                        <span className="text-[11px] font-medium text-white/45">Embed color</span>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            {COLOR_PRESETS.map(p => {
                                const active = wh.color === p.value;
                                return (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => selectPreset(p.value, p.hex)}
                                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                                            active
                                                ? "border-white/30 bg-white/[0.08] text-white"
                                                : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white"
                                        }`}
                                    >
                                        <span
                                            className="h-3 w-3 rounded-full"
                                            style={{background: p.hex}}
                                        />
                                        {p.label}
                                        {active && <FiCheck size={10}/>}
                                    </button>
                                );
                            })}
                            <div
                                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1">
                                <span className="text-xs text-white/40">HEX</span>
                                <input
                                    type="text"
                                    value={hexInput}
                                    onChange={e => handleHexChange(e.target.value)}
                                    placeholder="#5865F2"
                                    maxLength={7}
                                    className="w-20 bg-transparent text-xs text-white outline-none placeholder-white/20"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function StepWebhooks({draft, onChange}: Props) {
    const webhooks = draft.webhooks;

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
                <h3 className="text-sm font-semibold text-white">Discord Webhooks</h3>
                <p className="mt-1 text-sm text-white/50">
                    When a user submits this form, an embed with their answers will be sent to each configured webhook.
                    Webhooks are optional — skip this step if not needed.
                </p>
            </div>

            {webhooks.length > 0 && (
                <div className="flex flex-col gap-2">
                    {webhooks.map((wh, i) => (
                        <WebhookCard
                            key={i}
                            wh={wh}
                            index={i}
                            onUpdate={patch => update(i, patch)}
                            onDelete={() => remove(i)}
                        />
                    ))}
                </div>
            )}

            {webhooks.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/[0.08] py-8 text-center">
                    <FiLink size={20} className="mx-auto mb-2 text-white/20"/>
                    <p className="text-sm text-white/30">No webhooks configured</p>
                    <p className="mt-0.5 text-xs text-white/20">Click below to add one</p>
                </div>
            )}

            <button
                type="button"
                onClick={add}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-500/30 py-2.5 text-sm text-indigo-400 transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/[0.04] hover:text-indigo-300"
            >
                <FiPlus size={14}/>
                Add Webhook
            </button>
        </div>
    );
}
