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
    USER_LOGIN: {dot: "bg-[#3730A3]"},
    USER_BANNED: {dot: "bg-[#B56A65]"},
    USER_UNBANNED: {dot: "bg-[#5C8F6A]"},
    USER_ROLES_UPDATED: {dot: "bg-[#C99A3E]"},
    FORM_CREATED: {dot: "bg-[#5C8F6A]"},
    FORM_UPDATED: {dot: "bg-[#3730A3]"},
    FORM_DELETED: {dot: "bg-[#B56A65]"},
    SUBMISSION_CREATED: {dot: "bg-[#5C8F6A]"},
    SUBMISSION_DELETED: {dot: "bg-[#B56A65]"},
    ROLE_CREATED: {dot: "bg-[#5C8F6A]"},
    ROLE_UPDATED: {dot: "bg-[#3730A3]"},
    ROLE_DELETED: {dot: "bg-[#B56A65]"},
    SETTINGS_UPDATED: {dot: "bg-[#C99A3E]"},
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
                {icon && <span className="text-[#8B8B96]">{icon}</span>}
                <label className="text-sm font-medium text-[#1E1E24]">{label}</label>
            </div>
            <p className="mb-2.5 text-xs leading-relaxed text-[#6B6B76]">{description}</p>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] px-4 py-3 text-sm text-[#1E1E24] placeholder-[#C7C7CE] outline-none transition-colors focus:border-[#3730A3] focus:bg-white"
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] px-4 py-3 text-sm text-[#1E1E24] placeholder-[#C7C7CE] outline-none transition-colors focus:border-[#3730A3] focus:bg-white"
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
        <div className="rounded-xl border border-[#E4E4E7] bg-white overflow-hidden">
            <div className="flex items-start gap-4 border-b border-[#E4E4E7] px-6 py-4">
                <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#E4E4E7] bg-[#FAFAFB] text-[#8B8B96]">
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#1E1E24]">{title}</p>
                        {badge}
                    </div>
                    <p className="mt-0.5 text-xs text-[#6B6B76]">{description}</p>
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
                        ? "border-[#3730A3] bg-[#EEF0FB]"
                        : "border-[#D4D4D9] bg-white group-hover:border-[#B5B5BC]"
                }`}
            >
                {checked && <div className="h-2 w-2 rounded-sm bg-[#3730A3]"/>}
            </div>
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`}/>
            <span className={`text-xs transition-colors ${checked ? "text-[#55555F]" : "text-[#B5B5BC]"}`}>
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
                    <h1 className="text-xl font-semibold text-[#1E1E24]">{t("settings.title")}</h1>
                    <p className="mt-0.5 text-sm text-[#6B6B76]">{t("settings.subtitle")}</p>
                </div>
                {hasChanges && (
                    <span
                        className="flex items-center gap-1.5 rounded-full border border-[#EFDFC0] bg-[#FBF3E4] px-3 py-1 text-xs text-[#92702A]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#C99A3E]"/>
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
                                            ? "border-[#3730A3] bg-[#EEF0FB] text-[#3730A3]"
                                            : "border-[#E4E4E7] bg-white text-[#6B6B76] hover:border-[#D4D4D9] hover:text-[#1E1E24]"
                                    }`}
                                >
                                    {active && <div className="h-2 w-2 rounded-full bg-[#3730A3]"/>}
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
                            className="flex items-center gap-2 rounded-lg border border-[#D7E8D9] bg-[#EEF4EE] px-3 py-2 text-xs text-[#3F6B4A]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#5C8F6A]"/>
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
                                ? "border-[#EAD4D3] bg-[#F7EEEE] text-[#8B4A46]"
                                : allEnabled
                                    ? "border-[#D7E8D9] bg-[#EEF4EE] text-[#3F6B4A]"
                                    : "border-[#EFDFC0] bg-[#FBF3E4] text-[#92702A]"
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
                            className="rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs text-[#6B6B76] transition-colors hover:border-[#D7E8D9] hover:bg-[#EEF4EE] hover:text-[#3F6B4A]"
                        >
                            {t("settings.logFilters.selectAll")}
                        </button>
                        <button
                            onClick={deselectAll}
                            className="flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs text-[#6B6B76] transition-colors hover:border-[#EAD4D3] hover:bg-[#F7EEEE] hover:text-[#8B4A46]"
                        >
                            <FiMinus size={11}/>
                            {t("settings.logFilters.deselectAll")}
                        </button>
                        {disabledCount > 0 && (
                            <span className="text-xs text-[#8B8B96]">
                                {t("settings.logFilters.actionsSuppressed", {count: disabledCount})}
                            </span>
                        )}
                    </div>

                    {/* Groups */}
                    <div className="flex flex-col gap-4">
                        {ACTION_GROUPS.map(group => (
                            <div key={group.label}>
                                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">
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
                                className="rounded-full border border-[#D7E8D9] bg-[#EEF4EE] px-2 py-0.5 text-[10px] font-medium text-[#3F6B4A]">{t("settings.activeLabel")}</span>
                            : <span
                                className="rounded-full border border-[#E4E4E7] bg-[#F0F0F2] px-2 py-0.5 text-[10px] font-medium text-[#8B8B96]">{t("settings.notConfigured")}</span>
                    }
                >
                    {/* Variables reference */}
                    <div className="rounded-lg border border-[#D8DCF5] bg-[#EEF0FB] px-4 py-3">
                        <p className="mb-2 text-[11px] font-semibold text-[#3730A3]">{t("settings.availableVars")}</p>
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
                                      className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#3730A3] border border-[#D8DCF5] cursor-default">
                                    {v}
                                </span>
                            ))}
                        </div>
                        <p className="mt-2 text-[10px] text-[#8B8B96]">{t("settings.globalEmbed.varHint")}</p>
                    </div>

                    {/* Color */}
                    <div>
                        <span className="text-xs font-medium text-[#6B6B76]">{t("settings.globalEmbed.color")}</span>
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
                                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${active ? "border-[#D4D4D9] bg-[#F0F0F2] text-[#1E1E24]" : "border-[#E4E4E7] bg-white text-[#6B6B76] hover:text-[#1E1E24]"}`}>
                                        <span className="h-3 w-3 rounded-full" style={{background: p.hex}}/>
                                        {p.label}
                                        {active && <FiCheckCircle size={10}/>}
                                    </button>
                                );
                            })}
                            <div
                                className="flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1">
                                <span className="text-xs text-[#8B8B96]">HEX</span>
                                <input type="text"
                                       value={form.globalEmbedColor.startsWith("#") || (!form.globalEmbedColor && "") ? form.globalEmbedColor : ""}
                                       onChange={e => handleChange("globalEmbedColor", e.target.value)}
                                       placeholder="#5865F2" maxLength={7}
                                       className="w-20 bg-transparent text-xs text-[#1E1E24] outline-none placeholder-[#C7C7CE]"/>
                            </div>
                        </div>
                    </div>

                    {/* Author */}
                    <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">{t("settings.globalEmbed.authorGroup")}</p>
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
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">{t("settings.globalEmbed.contentGroup")}</p>
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
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">{t("settings.globalEmbed.imagesGroup")}</p>
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
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">{t("settings.globalEmbed.footerGroup")}</p>
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
                className="mt-6 flex items-center gap-4 rounded-xl border border-[#E4E4E7] bg-white px-5 py-4">
                <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="flex items-center gap-2 rounded-xl bg-[#3730A3] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2D2682] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <FiSave size={14}/>
                    {saving ? t("settings.saving") : t("settings.save")}
                </button>
                {saved && (
                    <div className="flex items-center gap-2 text-sm text-[#3F6B4A]">
                        <FiCheckCircle size={15}/>
                        {t("settings.saveSuccess")}
                    </div>
                )}
                {!hasChanges && !saved && (
                    <p className="text-xs text-[#C7C7CE]">{t("settings.noPendingChanges")}</p>
                )}
            </div>
        </div>
    );
}
