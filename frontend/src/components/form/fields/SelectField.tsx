import FieldWrapper from "./FieldWrapper";
import type { FormField } from "../../../types/forms";

interface Props {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function SelectField({ field, value, onChange, error }: Props) {
  return (
    <FieldWrapper label={field.label} required={field.required} error={error}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#0a0a0f] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      >
        <option value="" disabled>
          Select an option...
        </option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}