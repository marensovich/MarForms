import {useEffect, useState} from "react";
import {fetchSettings, type SystemSettings, updateSettings} from "../../api/settings";
import {TabSkeleton} from "./shared";
import {FiAlertOctagon, FiCheckCircle, FiGlobe, FiInfo, FiMessageSquare, FiSave, FiUser,} from "react-icons/fi";

function SettingField({
                          label,
                          description,
                          value,
                          onChange,
                          multiline = false,
                          placeholder,
                          icon,
                      }: {
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

function Section({
                     title,
                     description,
                     icon,
                     children,
                 }: {
    title: string;
    description: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="flex items-start gap-4 border-b border-white/[0.05] px-6 py-4">
                <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/50">
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-0.5 text-xs text-white/60">{description}</p>
                </div>
            </div>
            <div className="flex flex-col gap-5 p-6">
                {children}
            </div>
        </div>
    );
}

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

    if (loading) return <TabSkeleton/>;

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
