import {useEffect, useState} from "react";
import {fetchSettings, type SystemSettings, updateSettings,} from "../../api/settings";
import {TabSkeleton} from "./shared";

export default function SettingsTab() {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [form, setForm] = useState<SystemSettings>({
        banMessage: "",
        banAdminContact: "",
        systemName: "",
        systemContact: "",
    });

    useEffect(() => {
        fetchSettings()
            .then(data => {
                setSettings(data);
                setForm(data);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const updated = await updateSettings(form);
            setSettings(updated);
            setForm(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: keyof SystemSettings, value: string) => {
        setForm(prev => ({...prev, [key]: value}));
    };

    if (loading) return <TabSkeleton/>;

    return (
        <div className="max-w-xl">
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-white">System Settings</h1>
                <p className="mt-0.5 text-sm text-white/40">
                    Configure system-wide messages and contact information.
                </p>
            </div>

            <div className="flex flex-col gap-6">
                {/* Название системы */}
                <SettingField
                    label="System Name"
                    description="Displayed on the login page and ban screen."
                    value={form.systemName}
                    onChange={v => handleChange("systemName", v)}
                />

                {/* Контактные данные */}
                <SettingField
                    label="Contact Information"
                    description="General contact info shown to users (e.g. Discord server link)."
                    value={form.systemContact}
                    onChange={v => handleChange("systemContact", v)}
                />

                <div className="border-t border-white/10 pt-4">
                    <p className="mb-4 text-sm font-medium text-white/60">
                        Ban / Restriction Settings
                    </p>

                    {/* Сообщение о бане */}
                    <div className="mb-4">
                        <SettingField
                            label="Ban Message"
                            description="Shown to users when they are banned from the system."
                            value={form.banMessage}
                            onChange={v => handleChange("banMessage", v)}
                            multiline
                        />
                    </div>

                    {/* Ник администратора */}
                    <SettingField
                        label="Administrator Contact"
                        description="Username or contact shown on the ban screen."
                        value={form.banAdminContact}
                        onChange={v => handleChange("banAdminContact", v)}
                    />
                </div>

                {/* Кнопка сохранения */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? "Saving..." : "Save changes"}
                    </button>
                    {saved && (
                        <span className="text-sm text-emerald-400">
              ✓ Settings saved
            </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function SettingField({
                          label,
                          description,
                          value,
                          onChange,
                          multiline = false,
                      }: {
    label: string;
    description: string;
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
}) {
    return (
        <div>
            <label className="mb-1 block text-sm font-medium text-white">
                {label}
            </label>
            <p className="mb-2 text-xs text-white/40">{description}</p>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-indigo-500"
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-indigo-500"
                />
            )}
        </div>
    );
}