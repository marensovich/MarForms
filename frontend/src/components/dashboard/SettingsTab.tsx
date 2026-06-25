import {useEffect, useMemo, useState} from "react";
import {fetchSettings, type SystemSettings, updateSettings} from "../../api/settings";
import {TabSkeleton} from "./shared";
import type {AuditAction} from "../../types/logs";
import {
    FiAlertOctagon,
    FiCheckCircle,
    FiGlobe,
    FiImage,
    FiInfo,
    FiLink,
    FiList,
    FiMessageSquare,
    FiMinus,
    FiSave,
    FiUser,
} from "react-icons/fi";

// ── Action groups for the log-filter section ──────────────────────────────────

interface ActionMeta {
    label: string;
    dot: string
}

const ACTION_META: Record<AuditAction, ActionMeta> = {
    USER_LOGIN: {label: "Login", dot: "bg-indigo-400"},
    USER_BANNED: {label: "User Banned", dot: "bg-red-400"},
    USER_UNBANNED: {label: "User Unbanned", dot: "bg-emerald-400"},
    USER_ROLES_UPDATED: {label: "Roles Updated", dot: "bg-yellow-400"},
    FORM_CREATED: {label: "Form Created", dot: "bg-emerald-400"},
    FORM_UPDATED: {label: "Form Updated", dot: "bg-indigo-400"},
    FORM_DELETED: {label: "Form Deleted", dot: "bg-red-400"},
    SUBMISSION_CREATED: {label: "Submission Created", dot: "bg-emerald-400"},
    SUBMISSION_DELETED: {label: "Submission Deleted", dot: "bg-red-400"},
    ROLE_CREATED: {label: "Role Created", dot: "bg-emerald-400"},
    ROLE_UPDATED: {label: "Role Updated", dot: "bg-indigo-400"},
    ROLE_DELETED: {label: "Role Deleted", dot: "bg-red-400"},
    SETTINGS_UPDATED: {label: "Settings Updated", dot: "bg-yellow-400"},
};

const ACTION_GROUPS: { label: string; actions: AuditAction[] }[] = [
    {label: "Authentication", actions: ["USER_LOGIN"]},
    {label: "Users", actions: ["USER_BANNED", "USER_UNBANNED", "USER_ROLES_UPDATED"]},
    {label: "Forms", actions: ["FORM_CREATED", "FORM_UPDATED", "FORM_DELETED"]},
    {label: "Submissions", actions: ["SUBMISSION_CREATED", "SUBMISSION_DELETED"]},
    {label: "Roles", actions: ["ROLE_CREATED", "ROLE_UPDATED", "ROLE_DELETED"]},
    {label: "System", actions: ["SETTINGS_UPDATED"]},
];

const ALL_ACTIONS = ACTION_GROUPS.flatMap(g => g.actions);

// ── Reusable sub-components ───────────────────────────────────────────────────

function SettingField({label, description, value, onChange, multiline = false, placeholder, icon}: {
    label: string;
    description: string;
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
    placeholder?: string;
    icon?: React.ReactNode;
}) {
    return (
        <div>
            <div className="mb-1.5 flex items-center gap-2">
                {icon && <span className="text-white/30">{icon}</span>}
                <label className="text-sm font-medium text-white">{label}</label>
            </div>
            <p className="mb-2.5 text-xs leading-relaxed text-white/60">{description}</p>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-indigo-500/60 focus:bg-white/[0.05]"
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-indigo-500/60 focus:bg-white/[0.05]"
                />
            )}
        </div>
    );
}

function Section({title, description, icon, badge, children}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="flex items-start gap-4 border-b border-white/[0.05] px-6 py-4">
                <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/50">
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{title}</p>
                        {badge}
                    </div>
                    <p className="mt-0.5 text-xs text-white/60">{description}</p>
                </div>
            </div>
            <div className="flex flex-col gap-5 p-6">
                {children}
            </div>
        </div>
    );
}

// ── Action checkbox ───────────────────────────────────────────────────────────

function ActionCheckbox({action, checked, onChange}: {
    action: AuditAction;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    const {label, dot} = ACTION_META[action];
    return (
        <label className="flex cursor-pointer items-center gap-2.5 select-none group">
            <div
                onClick={() => onChange(!checked)}
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                    checked
                        ? "border-indigo-500/60 bg-indigo-500/25"
                        : "border-white/[0.12] bg-white/[0.03] group-hover:border-white/25"
                }`}
            >
                {checked && <div className="h-2 w-2 rounded-sm bg-indigo-400"/>}
            </div>
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`}/>
            <span className={`text-xs transition-colors ${checked ? "text-white/80" : "text-white/35"}`}>
                {label}
            </span>
        </label>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsTab() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [original, setOriginal] = useState<SystemSettings | null>(null);
    const [form, setForm] = useState<SystemSettings>({
        banMessage: "",
        banAdminContact: "",
        systemName: "",
        systemContact: "",
        logWebhookUrl: "",
        logEnabledActions: "",
        globalEmbedColor: "",
        globalEmbedTitle: "",
        globalEmbedDescription: "",
        globalEmbedAuthorName: "",
        globalEmbedAuthorIcon: "",
        globalEmbedAuthorUrl: "",
        globalEmbedThumbnail: "",
        globalEmbedImage: "",
        globalEmbedFooterText: "",
        globalEmbedFooterIcon: "",
    });

    useEffect(() => {
        fetchSettings()
            .then(data => {
                setOriginal(data);
                setForm(data);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (key: keyof SystemSettings, value: string) => {
        setForm(prev => {
            const next = {...prev, [key]: value};
            setHasChanges(JSON.stringify(next) !== JSON.stringify(original));
            return next;
        });
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const updated = await updateSettings(form);
            setOriginal(updated);
            setForm(updated);
            setHasChanges(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } finally {
            setSaving(false);
        }
    };

    // ── Log filter state ──────────────────────────────────────────────────────

    /** Set of currently-enabled action names. Empty raw value = all enabled. */
    const enabledSet = useMemo<Set<string>>(() => {
        const raw = form.logEnabledActions?.trim();
        if (!raw) return new Set(ALL_ACTIONS);
        return new Set(raw.split(",").map(s => s.trim()).filter(Boolean));
    }, [form.logEnabledActions]);

    const enabledCount = enabledSet.size;
    const allEnabled = enabledCount === ALL_ACTIONS.length;

    const toggleAction = (action: AuditAction, checked: boolean) => {
        const next = new Set(enabledSet);
        if (checked) next.add(action); else next.delete(action);
        // Store empty string when all are enabled (canonical default)
        const value = next.size === ALL_ACTIONS.length ? "" : [...next].join(",");
        handleChange("logEnabledActions", value);
    };

    const selectAll = () => handleChange("logEnabledActions", "");
    const deselectAll = () => handleChange("logEnabledActions", "__none__");

    // "__none__" is a sentinel that won't match any real action name
    const isEnabled = (a: AuditAction) =>
        form.logEnabledActions?.trim() === "__none__" ? false : enabledSet.has(a);

    if (loading) return <TabSkeleton/>;

    const disabledCount = ALL_ACTIONS.length - (form.logEnabledActions?.trim() === "__none__" ? 0 : enabledCount);

    return (
        <div className="max-w-2xl">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">System Settings</h1>
                    <p className="mt-0.5 text-sm text-white/65">
                        Configure system-wide messages and contact information
                    </p>
                </div>
                {hasChanges && (
                    <span
                        className="flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs text-orange-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400"/>
                        Unsaved changes
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-4">
                {/* General */}
                <Section
                    title="General"
                    description="Basic system identity shown to users on login and throughout the interface."
                    icon={<FiGlobe size={16}/>}
                >
                    <SettingField
                        label="System Name"
                        description="Displayed on the login page and throughout the interface."
                        value={form.systemName}
                        onChange={v => handleChange("systemName", v)}
                        placeholder="e.g. MarForms"
                        icon={<FiInfo size={13}/>}
                    />
                    <SettingField
                        label="Contact Information"
                        description="General contact shown to users — such as a Discord server invite link."
                        value={form.systemContact}
                        onChange={v => handleChange("systemContact", v)}
                        placeholder="e.g. discord.gg/yourserver"
                        icon={<FiMessageSquare size={13}/>}
                    />
                </Section>

                {/* Audit Log Webhook */}
                <Section
                    title="Audit Log Webhook"
                    description="Optionally forward every audit log entry to a Discord channel in real time."
                    icon={<FiLink size={16}/>}
                >
                    <SettingField
                        label="Discord Webhook URL"
                        description="Paste a Discord webhook URL to receive log notifications. Leave blank to disable Discord forwarding."
                        value={form.logWebhookUrl}
                        onChange={v => handleChange("logWebhookUrl", v)}
                        placeholder="https://discord.com/api/webhooks/…"
                        icon={<FiLink size={13}/>}
                    />
                    {form.logWebhookUrl.trim() && (
                        <div
                            className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>
                            Discord logging is active — enabled events will be forwarded.
                        </div>
                    )}
                </Section>

                {/* Log Filters */}
                <Section
                    title="Log Filters"
                    description="Choose which action types are recorded. Disabled actions are silently dropped — they won't appear in the log table or Discord."
                    icon={<FiList size={16}/>}
                    badge={
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            form.logEnabledActions?.trim() === "__none__"
                                ? "border-red-500/25 bg-red-500/10 text-red-400"
                                : allEnabled
                                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                                    : "border-yellow-500/25 bg-yellow-500/10 text-yellow-400"
                        }`}>
                            {form.logEnabledActions?.trim() === "__none__"
                                ? "none"
                                : allEnabled
                                    ? "all"
                                    : `${enabledCount} / ${ALL_ACTIONS.length}`}
                        </span>
                    }
                >
                    {/* Bulk controls */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={selectAll}
                            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-300"
                        >
                            Select all
                        </button>
                        <button
                            onClick={deselectAll}
                            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-300"
                        >
                            <FiMinus size={11}/>
                            Deselect all
                        </button>
                        {disabledCount > 0 && (
                            <span className="text-xs text-white/30">
                                {disabledCount} action{disabledCount !== 1 ? "s" : ""} suppressed
                            </span>
                        )}
                    </div>

                    {/* Groups */}
                    <div className="flex flex-col gap-4">
                        {ACTION_GROUPS.map(group => (
                            <div key={group.label}>
                                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                                    {group.label}
                                </p>
                                <div className="flex flex-wrap gap-x-6 gap-y-2.5">
                                    {group.actions.map(action => (
                                        <ActionCheckbox
                                            key={action}
                                            action={action}
                                            checked={isEnabled(action)}
                                            onChange={checked => toggleAction(action, checked)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>

                {/* Global Embed */}
                <Section
                    title="Global Embed"
                    description="Second embed appended to every webhook submission message. Configures the branding block visible below the form answers."
                    icon={<FiImage size={16}/>}
                    badge={
                        (form.globalEmbedAuthorName?.trim() || form.globalEmbedFooterText?.trim() || form.globalEmbedTitle?.trim())
                            ? <span
                                className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">active</span>
                            : <span
                                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/30">not configured</span>
                    }
                >
                    {/* Variables reference */}
                    <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/5 px-4 py-3">
                        <p className="mb-2 text-[11px] font-semibold text-indigo-300/80">Available variables</p>
                        <div className="flex flex-wrap gap-1.5">
                            {[
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
                            ].map(([v, hint]) => (
                                <span key={v} title={hint}
                                      className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] text-indigo-300 border border-indigo-500/20 cursor-default">
                                    {v}
                                </span>
                            ))}
                        </div>
                        <p className="mt-2 text-[10px] text-white/25">Work in all text fields. <span
                            className="text-yellow-400/60">{"{user_mention}"} renders as a ping only in content and description — not in author/title/footer.</span>
                        </p>
                    </div>

                    {/* Color */}
                    <div>
                        <span className="text-xs font-medium text-white/50">Embed color</span>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                            {[
                                {label: "Blurple", hex: "#5865F2", val: "5793266"},
                                {label: "Green", hex: "#57F287", val: "5763719"},
                                {label: "Red", hex: "#ED4245", val: "15548997"},
                                {label: "Gold", hex: "#F1C40F", val: "15844367"},
                                {label: "Cyan", hex: "#1ABC9C", val: "1752220"},
                            ].map(p => {
                                const active = form.globalEmbedColor === p.val;
                                return (
                                    <button key={p.val} type="button"
                                            onClick={() => handleChange("globalEmbedColor", active ? "" : p.val)}
                                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${active ? "border-white/30 bg-white/[0.08] text-white" : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white"}`}>
                                        <span className="h-3 w-3 rounded-full" style={{background: p.hex}}/>
                                        {p.label}
                                        {active && <FiCheckCircle size={10}/>}
                                    </button>
                                );
                            })}
                            <div
                                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1">
                                <span className="text-xs text-white/40">HEX</span>
                                <input type="text"
                                       value={form.globalEmbedColor.startsWith("#") || (!form.globalEmbedColor && "") ? form.globalEmbedColor : ""}
                                       onChange={e => handleChange("globalEmbedColor", e.target.value)}
                                       placeholder="#5865F2" maxLength={7}
                                       className="w-20 bg-transparent text-xs text-white outline-none placeholder-white/20"/>
                            </div>
                        </div>
                    </div>

                    {/* Author */}
                    <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Author</p>
                        <div className="flex flex-col gap-2.5">
                            <SettingField
                                label="Author name"
                                description='Shown at the top of the embed. Supports variables. E.g. "MarForms v1.0 by marensovich"'
                                value={form.globalEmbedAuthorName}
                                onChange={v => handleChange("globalEmbedAuthorName", v)}
                                placeholder="MarForms v1.0 by marensovich"
                                icon={<FiUser size={13}/>}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <SettingField
                                    label="Author icon URL"
                                    description="Small circle image next to the name"
                                    value={form.globalEmbedAuthorIcon}
                                    onChange={v => handleChange("globalEmbedAuthorIcon", v)}
                                    placeholder="https://…/logo.png"
                                    icon={<FiLink size={13}/>}
                                />
                                <SettingField
                                    label="Author URL"
                                    description="Makes the author name a clickable link"
                                    value={form.globalEmbedAuthorUrl}
                                    onChange={v => handleChange("globalEmbedAuthorUrl", v)}
                                    placeholder="https://…"
                                    icon={<FiLink size={13}/>}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Title + Description */}
                    <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Content</p>
                        <div className="flex flex-col gap-2.5">
                            <SettingField
                                label="Title"
                                description="Optional embed title. Supports variables."
                                value={form.globalEmbedTitle}
                                onChange={v => handleChange("globalEmbedTitle", v)}
                                placeholder="Submission received · {form_title}"
                                icon={<FiInfo size={13}/>}
                            />
                            <SettingField
                                label="Description"
                                description="Text below the title. Supports markdown and variables."
                                value={form.globalEmbedDescription}
                                onChange={v => handleChange("globalEmbedDescription", v)}
                                placeholder="Submitted by {user_mention} at {timestamp}"
                                multiline
                                icon={<FiMessageSquare size={13}/>}
                            />
                        </div>
                    </div>

                    {/* Images */}
                    <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Images</p>
                        <div className="grid grid-cols-2 gap-3">
                            <SettingField
                                label="Thumbnail URL"
                                description="Small image, top-right corner"
                                value={form.globalEmbedThumbnail}
                                onChange={v => handleChange("globalEmbedThumbnail", v)}
                                placeholder="https://…/thumb.png"
                                icon={<FiImage size={13}/>}
                            />
                            <SettingField
                                label="Image URL"
                                description="Large banner below content"
                                value={form.globalEmbedImage}
                                onChange={v => handleChange("globalEmbedImage", v)}
                                placeholder="https://…/banner.png"
                                icon={<FiImage size={13}/>}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Footer</p>
                        <div className="flex flex-col gap-2.5">
                            <SettingField
                                label="Footer text"
                                description='Text at the bottom of the embed. Supports variables. E.g. "MarForms v1.0.0 by marensovich"'
                                value={form.globalEmbedFooterText}
                                onChange={v => handleChange("globalEmbedFooterText", v)}
                                placeholder="MarForms v1.0.0 by marensovich"
                                icon={<FiInfo size={13}/>}
                            />
                            <SettingField
                                label="Footer icon URL"
                                description="Small circle image next to the footer text"
                                value={form.globalEmbedFooterIcon}
                                onChange={v => handleChange("globalEmbedFooterIcon", v)}
                                placeholder="https://…/icon.png"
                                icon={<FiLink size={13}/>}
                            />
                        </div>
                    </div>
                </Section>

                {/* Ban Settings */}
                <Section
                    title="Ban & Restriction Settings"
                    description="Customize what restricted users see when they try to access the system."
                    icon={<FiAlertOctagon size={16}/>}
                >
                    <SettingField
                        label="Ban Message"
                        description="The message displayed to users who have been banned from the system."
                        value={form.banMessage}
                        onChange={v => handleChange("banMessage", v)}
                        placeholder="You have been restricted from accessing this system."
                        multiline
                        icon={<FiAlertOctagon size={13}/>}
                    />
                    <SettingField
                        label="Administrator Contact"
                        description="Username or contact information shown on the ban screen for appeals."
                        value={form.banAdminContact}
                        onChange={v => handleChange("banAdminContact", v)}
                        placeholder="e.g. @admin"
                        icon={<FiUser size={13}/>}
                    />
                </Section>
            </div>

            {/* Save bar */}
            <div
                className="mt-6 flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <FiSave size={14}/>
                    {saving ? "Saving…" : "Save changes"}
                </button>
                {saved && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                        <FiCheckCircle size={15}/>
                        Settings saved successfully
                    </div>
                )}
                {!hasChanges && !saved && (
                    <p className="text-xs text-white/25">No pending changes</p>
                )}
            </div>
        </div>
    );
}
