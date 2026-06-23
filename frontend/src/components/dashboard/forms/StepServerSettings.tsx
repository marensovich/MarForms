import type { FormDraft } from "./FormWizard";

interface Props {
  draft: FormDraft;
  onChange: (patch: Partial<FormDraft>) => void;
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-indigo-500";

export default function StepServerSettings({ draft, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-white">
          Discord Server ID <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={draft.serverId}
          onChange={e => onChange({ serverId: e.target.value })}
          placeholder="e.g. 1234567890123456789"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-white/30">
          Only members of this Discord server will be able to fill the form.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-white">
          Channel IDs
          <span className="ml-1 text-white/30">(optional)</span>
        </label>
        <input
          type="text"
          value={draft.channelsIds.join(", ")}
          onChange={e =>
            onChange({
              channelsIds: e.target.value
                .split(",")
                .map(s => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="e.g. 111222333, 444555666"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-white/30">
          Comma-separated channel IDs. Leave empty to allow all channels.
        </p>
      </div>
    </div>
  );
}