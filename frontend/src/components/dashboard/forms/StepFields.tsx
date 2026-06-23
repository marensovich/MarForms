import { useRef, useState } from "react";
import type { FormField, FieldType } from "../../../types/forms";
import type { FormDraft } from "./FormWizard";

interface Props {
  draft: FormDraft;
  onChange: (patch: Partial<FormDraft>) => void;
}

type FieldTypeGroup = { label: string; types: { value: FieldType; label: string }[] };

const FIELD_TYPE_GROUPS: FieldTypeGroup[] = [
  {
    label: "Text",
    types: [
      { value: "TEXT", label: "Short text" },
      { value: "TEXTAREA", label: "Long text" },
      { value: "NUMBER", label: "Number" },
      { value: "EMAIL", label: "Email" },
      { value: "URL", label: "URL" },
      { value: "PHONE", label: "Phone" },
    ],
  },
  {
    label: "Choice",
    types: [
      { value: "SELECT", label: "Dropdown — single choice" },
      { value: "MULTI_SELECT", label: "Dropdown — multiple choices" },
      { value: "RADIO", label: "Radio buttons" },
      { value: "CHECKBOX", label: "Checkboxes" },
      { value: "BOOLEAN", label: "Toggle (yes / no)" },
    ],
  },
  {
    label: "Date & Time",
    types: [
      { value: "DATE", label: "Date" },
      { value: "TIME", label: "Time" },
      { value: "DATETIME", label: "Date & Time" },
    ],
  },
];

const ALL_TYPES = FIELD_TYPE_GROUPS.flatMap(g => g.types);

const HAS_OPTIONS: FieldType[] = ["SELECT", "MULTI_SELECT", "RADIO", "CHECKBOX"];
const HAS_PLACEHOLDER: FieldType[] = ["TEXT", "TEXTAREA", "NUMBER", "EMAIL", "URL", "PHONE"];
const HAS_MIN_MAX: FieldType[] = ["TEXT", "TEXTAREA", "NUMBER"];

function makeField(): FormField {
  return { id: crypto.randomUUID(), type: "TEXT", label: "", required: false, options: [] };
}

export default function StepFields({ draft, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const setFields = (fields: FormField[]) => onChange({ fields });

  const addField = () => {
    const f = makeField();
    setFields([...draft.fields, f]);
    setExpandedId(f.id);
  };

  const removeField = (id: string) => {
    setFields(draft.fields.filter(f => f.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const duplicateField = (id: string) => {
    const src = draft.fields.find(f => f.id === id);
    if (!src) return;
    const copy: FormField = { ...src, id: crypto.randomUUID(), label: src.label ? `${src.label} (copy)` : "" };
    const idx = draft.fields.findIndex(f => f.id === id);
    const next = [...draft.fields];
    next.splice(idx + 1, 0, copy);
    setFields(next);
    setExpandedId(copy.id);
  };

  const updateField = (id: string, patch: Partial<FormField>) => {
    setFields(draft.fields.map(f => (f.id === id ? { ...f, ...patch } : f)));
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const next = [...draft.fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFields(next);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/50">
          {draft.fields.length === 0
            ? "No fields yet — add your first field below."
            : `${draft.fields.length} field${draft.fields.length !== 1 ? "s" : ""}`}
        </p>
        <button
          onClick={addField}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
        >
          + Add field
        </button>
      </div>

      <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
        {draft.fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 py-10 text-center">
            <p className="text-sm text-white/30">No fields yet</p>
            <button
              onClick={addField}
              className="rounded-lg border border-indigo-500/30 bg-indigo-600/20 px-4 py-2 text-xs text-indigo-400 transition-colors hover:bg-indigo-600/30"
            >
              + Add your first field
            </button>
          </div>
        ) : (
          draft.fields.map((field, idx) => (
            <FieldCard
              key={field.id}
              field={field}
              idx={idx}
              total={draft.fields.length}
              expanded={expandedId === field.id}
              onToggle={() => setExpandedId(expandedId === field.id ? null : field.id)}
              onUpdate={patch => updateField(field.id, patch)}
              onRemove={() => removeField(field.id)}
              onDuplicate={() => duplicateField(field.id)}
              onMove={dir => moveField(idx, dir)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface FieldCardProps {
  field: FormField;
  idx: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
}

function FieldCard({ field, idx, total, expanded, onToggle, onUpdate, onRemove, onDuplicate, onMove }: FieldCardProps) {
  const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500 transition-colors";

  const hasOptions = HAS_OPTIONS.includes(field.type);
  const hasPlaceholder = HAS_PLACEHOLDER.includes(field.type);
  const hasMinMax = HAS_MIN_MAX.includes(field.type);

  const typeLabel = ALL_TYPES.find(t => t.value === field.type)?.label ?? field.type;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onMove(-1)}
            disabled={idx === 0}
            className="text-[9px] leading-tight text-white/30 transition-colors hover:text-white disabled:opacity-20"
          >
            ▲
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={idx === total - 1}
            className="text-[9px] leading-tight text-white/30 transition-colors hover:text-white disabled:opacity-20"
          >
            ▼
          </button>
        </div>

        <button onClick={onToggle} className="flex flex-1 items-center gap-3 text-left overflow-hidden">
          <span className="shrink-0 rounded-md bg-indigo-600/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
            {typeLabel}
          </span>
          <span className="flex-1 truncate text-sm text-white">
            {field.label || <span className="text-white/30">Untitled field</span>}
          </span>
          {field.required && <span className="shrink-0 text-[10px] font-medium text-red-400">required</span>}
          <span className="shrink-0 text-xs text-white/30">{expanded ? "▾" : "▸"}</span>
        </button>

        <button
          onClick={onDuplicate}
          title="Duplicate field"
          className="px-1 text-sm text-white/30 transition-colors hover:text-white/70"
        >
          ⧉
        </button>
        <button
          onClick={onRemove}
          className="px-1 text-white/30 transition-colors hover:text-red-400"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-white/50">
                  Label <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={field.label}
                  onChange={e => onUpdate({ label: e.target.value })}
                  placeholder="Field label"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Type</label>
                <select
                  value={field.type}
                  onChange={e => onUpdate({ type: e.target.value as FieldType, options: [] })}
                  className="w-full rounded-lg border border-white/10 bg-[#0f0f17] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                >
                  {FIELD_TYPE_GROUPS.map(group => (
                    <optgroup key={group.label} label={group.label}>
                      {group.types.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {hasPlaceholder && (
              <div>
                <label className="mb-1 block text-xs text-white/50">Placeholder</label>
                <input
                  type="text"
                  value={field.placeholder ?? ""}
                  onChange={e => onUpdate({ placeholder: e.target.value || undefined })}
                  placeholder="Hint shown inside the input"
                  className={inputClass}
                />
              </div>
            )}

            {hasOptions && (
              <OptionsEditor
                options={field.options ?? []}
                onChange={opts => onUpdate({ options: opts })}
                fieldType={field.type}
              />
            )}

            {hasMinMax && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">
                    {field.type === "NUMBER" ? "Min value" : "Min length"}
                  </label>
                  <input
                    type="number"
                    value={field.min ?? ""}
                    onChange={e => onUpdate({ min: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="—"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">
                    {field.type === "NUMBER" ? "Max value" : "Max length"}
                  </label>
                  <input
                    type="number"
                    value={field.max ?? ""}
                    onChange={e => onUpdate({ max: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="—"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-white/50">
                Helper text <span className="text-white/30">(optional)</span>
              </label>
              <input
                type="text"
                value={field.description ?? ""}
                onChange={e => onUpdate({ description: e.target.value || undefined })}
                placeholder="Additional guidance shown below the field"
                className={inputClass}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-colors hover:border-white/20">
              <input
                type="checkbox"
                checked={field.required}
                onChange={e => onUpdate({ required: e.target.checked })}
                className="h-4 w-4 accent-indigo-500"
              />
              <span className="text-sm text-white/70">Required field</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

interface OptionsEditorProps {
  options: string[];
  onChange: (opts: string[]) => void;
  fieldType: FieldType;
}

const OPTION_TYPE_HINT: Partial<Record<FieldType, string>> = {
  SELECT: "Single choice — dropdown",
  MULTI_SELECT: "Multiple choices — dropdown",
  RADIO: "Single choice — radio buttons",
  CHECKBOX: "Multiple choices — checkboxes",
};

function OptionsEditor({ options, onChange, fieldType }: OptionsEditorProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const addOption = (afterIndex?: number) => {
    const next = [...options];
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : next.length;
    next.splice(insertAt, 0, "");
    onChange(next);
    setTimeout(() => inputRefs.current[insertAt]?.focus(), 0);
  };

  const removeOption = (i: number) => {
    onChange(options.filter((_, j) => j !== i));
    setTimeout(() => inputRefs.current[Math.max(0, i - 1)]?.focus(), 0);
  };

  const updateOption = (i: number, val: string) => {
    onChange(options.map((o, j) => (j === i ? val : o)));
  };

  const moveOption = (i: number, dir: -1 | 1) => {
    const next = [...options];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
    setTimeout(() => inputRefs.current[target]?.focus(), 0);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-xs text-white/50">
          Options <span className="text-red-400">*</span>
        </label>
        {OPTION_TYPE_HINT[fieldType] && (
          <span className="text-[10px] text-white/30">{OPTION_TYPE_HINT[fieldType]}</span>
        )}
      </div>

      {options.length === 0 && (
        <p className="mb-2 text-[11px] text-amber-400/60">No options yet — add at least one</p>
      )}

      <div className="flex flex-col gap-1.5 mb-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => moveOption(i, -1)}
                disabled={i === 0}
                className="px-0.5 text-[8px] leading-tight text-white/20 transition-colors hover:text-white/60 disabled:opacity-20"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveOption(i, 1)}
                disabled={i === options.length - 1}
                className="px-0.5 text-[8px] leading-tight text-white/20 transition-colors hover:text-white/60 disabled:opacity-20"
              >
                ▼
              </button>
            </div>

            <span className="w-5 select-none text-right text-xs text-white/20">{i + 1}.</span>

            <input
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              value={opt}
              onChange={e => updateOption(i, e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption(i);
                }
                if (e.key === "Backspace" && opt === "") {
                  e.preventDefault();
                  removeOption(i);
                }
              }}
              placeholder={`Option ${i + 1}`}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-indigo-500"
            />

            <button
              type="button"
              onClick={() => removeOption(i)}
              className="px-1 text-xs text-white/20 transition-colors hover:text-red-400"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => addOption()}
        className="flex items-center gap-1 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
      >
        + Add option
        <span className="text-[10px] text-white/20">(or press Enter in a field)</span>
      </button>
    </div>
  );
}
