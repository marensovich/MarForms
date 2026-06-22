import FieldWrapper from "./FieldWrapper";
import type { FormField } from "../../../types/forms";

interface Props {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export default function TextField({ field, value, onChange, error }: Props) {
  const isTextarea = field.type === "TEXTAREA";

  return (
    <FieldWrapper label={field.label} required={field.required} error={error}>
      {isTextarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}...`}
          rows={4}
          maxLength={field.max ?? undefined}
          minLength={field.min ?? undefined}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          type={fieldTypeToInputType(field.type)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}...`}
          max={field.max ?? undefined}
          min={field.min ?? undefined}
          className={inputClass}
        />
      )}
    </FieldWrapper>
  );
}

function fieldTypeToInputType(type: FormField["type"]): string {
  const map: Partial<Record<FormField["type"], string>> = {
    TEXT: "text",
    NUMBER: "number",
    EMAIL: "email",
    PASSWORD: "password",
    URL: "url",
    PHONE: "tel",
    DATE: "date",
    TIME: "time",
    DATETIME: "datetime-local",
  };
  return map[type] ?? "text";
}