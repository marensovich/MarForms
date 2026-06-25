import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {fetchSettings, type SystemSettings, updateSettings} from "../../api/settings";
import {TabSkeleton} from "./shared";
import i18n from "../../i18n";
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
    FiMonitor,
} from "react-icons/fi";

// ── Action groups for the log-filter section ──────────────────────────────────

const ACTION_META: Record<AuditAction, { dot: string }> = {
    USER_LOGIN: {dot: "bg-indigo-400"},
    USER_BANNED: {dot: "bg-red-400"},
    USER_UNBANNED: {dot: "bg-emerald-400"},
    USER_ROLES_UPDATED: {dot: "bg-yellow-400"},
    FORM_CREATED: {dot: "bg-emerald-400"},
    FORM_UPDATED: {dot: "bg-indigo-400"},
    FORM_DELETED: {dot: "bg-red-400"},
    SUBMISSION_CREATED: {dot: "bg-emerald-400"},
    SUBMISSION_DELETED: {dot: "bg-red-400"},
    ROLE_CREATED: {dot: "bg-emerald-400"},
    ROLE_UPDATED: {dot: "bg-indigo-400"},
    ROLE_DELETED: {dot: "bg-red-400"},
    SETTINGS_UPDATED: {dot: "bg-yellow-400"},
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
    const {t} = useTranslation();
    const {dot} = ACTION_META[action];
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
                {t(`settings.logFilters.actions.${action}`)}
            </span>
        </label>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsTab() {
    const {t} = useTranslation();
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
        uiLanguage: "en",
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
            if (updated.uiLanguage && i18n.language !== updated.uiLanguage) {
                i18n.changeLanguage(updated.uiLanguage);
            }
        } finally {
            setSaving(false);
        }
    };

    // ── Log filter state ──────────────────────────────────────────────────────

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
        const value = next.size === ALL_ACTIONS.length ? "" : [...next].join(",");
        handleChange("logEnabledActions", value);
    };

    const selectAll = () => handleChange("logEnabledActions", "");
    const deselectAll = () => handleChange("logEnabledActions", "__none__");

    const isEnabled = (a: AuditAction) =>
        form.logEnabledActions?.trim() === "__none__" ? false : enabledSet.has(a);

    if (loading) return <TabSkeleton/>;

    const disabledCount = ALL_ACTIONS.length - (form.logEnabledActions?.trim() === "__none__" ? 0 : enabledCount);

    return (
        <div className="max-w-2xl">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">{t("settings.title")}</h1>
                    <p className="mt-0.5 text-sm text-white/65">{t("settings.subtitle")}</p>
                </div>
                {hasChanges && (
                    <span
                        className="flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs text-orange-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400"/>
                        {t("settings.unsavedChanges")}
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-4">
                {/* General */}
                <Section
                    title={t("settings.sections.general")}
                    description={t("settings.sections.generalDesc")}
                    icon={<FiGlobe size={16}/>}
                >
                    <SettingField
                        label={t("settings.general.systemName")}
                        description={t("settings.general.systemNameDesc")}
                        value={form.systemName}
                        onChange={v => handleChange("systemName", v)}
                        placeholder="e.g. MarForms"
                        icon={<FiInfo size={13}/>}
                    />
                    <SettingField
                        label={t("settings.general.systemContact")}
                        description={t("settings.general.systemContactDesc")}
                        value={form.systemContact}
                        onChange={v => handleChange("systemContact", v)}
                        placeholder="e.g. discord.gg/yourserver"
                        icon={<FiMessageSquare size={13}/>}
                    />
                </Section>

                {/* Interface Language */}
                <Section
                    title={t("settings.sections.language")}
                    description={t("settings.language.desc")}
                    icon={<FiMonitor size={16}/>}
                >
                    <div className="flex gap-3">
                        {(["en", "ru"] as const).map(lang => {
                            const active = form.uiLanguage === lang;
                            return (
                                <button
                                    key={lang}
                                    type="button"
                                    onClick={() => handleChange("uiLanguage", lang)}
                                    className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-colors ${
                                        active
                                            ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-300"
                                            : "border-white/[0.08] bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white"
                                    }`}
                                >
                                    {active && <div className="h-2 w-2 rounded-full bg-indigo-400"/>}
                                    {t(`settings.language.${lang}`)}
                                </button>
                            );
                        })}
                    </div>
                </Section>

                {/* Audit Log Webhook */}
                <Section
                    title={t("settings.sections.auditLog")}
                    description={t("settings.sections.auditLogDesc")}
                    icon={<FiLink size={16}/>}
                >
                    <SettingField
                        label={t("settings.auditLog.webhookUrl")}
                        description={t("settings.auditLog.webhookUrlDesc")}
                        value={form.logWebhookUrl}
                        onChange={v => handleChange("logWebhookUrl", v)}
                        placeholder="https://discord.com/api/webhooks/…"
                        icon={<FiLink size={13}/>}
                    />
                    {form.logWebhookUrl.trim() && (
                        <div
                            className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>
                            {t("settings.discordLoggingActive")}
                        </div>
                    )}
                </Section>

                {/* Log Filters */}
                <Section
                    title={t("settings.sections.logFilters")}
                    description={t("settings.sections.logFiltersDesc")}
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
                                ? t("settings.logFilters.noneLabel")
                                : allEnabled
                                    ? t("settings.logFilters.allLabel")
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
                            {t("settings.logFilters.selectAll")}
                        </button>
                        <button
                            onClick={deselectAll}
                            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-300"
                        >
                            <FiMinus size={11}/>
                            {t("settings.logFilters.deselectAll")}
                        </button>
                        {disabledCount > 0 && (
                            <span className="text-xs text-white/30">
                                {t("settings.logFilters.actionsSuppressed", {count: disabledCount})}
                            </span>
                        )}
                    </div>

                    {/* Groups */}
                    <div className="flex flex-col gap-4">
                        {ACTION_GROUPS.map(group => (
                            <div key={group.label}>
                                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                                    {t(`settings.logFilters.groups.${group.label}`)}
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
                    title={t("settings.sections.globalEmbed")}
                    description={t("settings.sections.globalEmbedDesc")}
                    icon={<FiImage size={16}/>}
                    badge={
                        (form.globalEmbedAuthorName?.trim() || form.globalEmbedFooterText?.trim() || form.globalEmbedTitle?.trim())
                            ? <span
                                className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">{t("settings.activeLabel")}</span>
                            : <span
                                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/30">{t("settings.notConfigured")}</span>
                    }
                >
                    {/* Variables reference */}
                    <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/5 px-4 py-3">
                        <p className="mb-2 text-[11px] font-semibold text-indigo-300/80">{t("settings.availableVars")}</p>
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
                        <p className="mt-2 text-[10px] text-white/25">{t("settings.globalEmbed.varHint")}</p>
                    </div>

                    {/* Color */}
                    <div>
                        <span className="text-xs font-medium text-white/50">{t("settings.globalEmbed.color")}</span>
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
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">{t("settings.globalEmbed.authorGroup")}</p>
                        <div className="flex flex-col gap-2.5">
                            <SettingField
                                label={t("settings.globalEmbed.authorName")}
                                description={t("settings.globalEmbed.authorNameDesc")}
                                value={form.globalEmbedAuthorName}
                                onChange={v => handleChange("globalEmbedAuthorName", v)}
                                placeholder="MarForms v1.0 by marensovich"
                                icon={<FiUser size={13}/>}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <SettingField
                                    label={t("settings.globalEmbed.authorIconUrl")}
                                    description={t("settings.globalEmbed.authorIconDesc")}
                                    value={form.globalEmbedAuthorIcon}
                                    onChange={v => handleChange("globalEmbedAuthorIcon", v)}
                                    placeholder="https://…/logo.png"
                                    icon={<FiLink size={13}/>}
                                />
                                <SettingField
                                    label={t("settings.globalEmbed.authorUrl")}
                                    description={t("settings.globalEmbed.authorUrlDesc")}
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
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">{t("settings.globalEmbed.contentGroup")}</p>
                        <div className="flex flex-col gap-2.5">
                            <SettingField
                                label={t("settings.globalEmbed.embedTitle")}
                                description={t("settings.globalEmbed.titleDesc")}
                                value={form.globalEmbedTitle}
                                onChange={v => handleChange("globalEmbedTitle", v)}
                                placeholder="Submission received · {form_title}"
                                icon={<FiInfo size={13}/>}
                            />
                            <SettingField
                                label={t("settings.globalEmbed.embedDesc")}
                                description={t("settings.globalEmbed.descDesc")}
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
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">{t("settings.globalEmbed.imagesGroup")}</p>
                        <div className="grid grid-cols-2 gap-3">
                            <SettingField
                                label={t("settings.globalEmbed.thumbnailUrl")}
                                description={t("settings.globalEmbed.thumbnailDesc")}
                                value={form.globalEmbedThumbnail}
                                onChange={v => handleChange("globalEmbedThumbnail", v)}
                                placeholder="https://…/thumb.png"
                                icon={<FiImage size={13}/>}
                            />
                            <SettingField
                                label={t("settings.globalEmbed.imageUrl")}
                                description={t("settings.globalEmbed.imageDesc")}
                                value={form.globalEmbedImage}
                                onChange={v => handleChange("globalEmbedImage", v)}
                                placeholder="https://…/banner.png"
                                icon={<FiImage size={13}/>}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">{t("settings.globalEmbed.footerGroup")}</p>
                        <div className="flex flex-col gap-2.5">
                            <SettingField
                                label={t("settings.globalEmbed.footerText")}
                                description={t("settings.globalEmbed.footerTextDesc")}
                                value={form.globalEmbedFooterText}
                                onChange={v => handleChange("globalEmbedFooterText", v)}
                                placeholder="MarForms v1.0.0 by marensovich"
                                icon={<FiInfo size={13}/>}
                            />
                            <SettingField
                                label={t("settings.globalEmbed.footerIconUrl")}
                                description={t("settings.globalEmbed.footerIconDesc")}
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
                    title={t("settings.sections.ban")}
                    description={t("settings.sections.banDesc")}
                    icon={<FiAlertOctagon size={16}/>}
                >
                    <SettingField
                        label={t("settings.general.banMessage")}
                        description={t("settings.general.banMessageDesc")}
                        value={form.banMessage}
                        onChange={v => handleChange("banMessage", v)}
                        placeholder="You have been restricted from accessing this system."
                        multiline
                        icon={<FiAlertOctagon size={13}/>}
                    />
                    <SettingField
                        label={t("settings.general.banContact")}
                        description={t("settings.general.banContactDesc")}
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
                    {saving ? t("settings.saving") : t("settings.save")}
                </button>
                {saved && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                        <FiCheckCircle size={15}/>
                        {t("settings.saveSuccess")}
                    </div>
                )}
                {!hasChanges && !saved && (
                    <p className="text-xs text-white/25">{t("settings.noPendingChanges")}</p>
                )}
            </div>
        </div>
    );
}
