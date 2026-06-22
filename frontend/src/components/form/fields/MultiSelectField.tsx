import FieldWrapper from "./FieldWrapper";
import type { FormField } from "../../../types/forms";

interface Props {
  field: FormField;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

export default function MultiSelectField({
  field,
  value,
  onChange,
  error,
}: Props) {
  const toggle = (opt: string) => {
    onChange(
      value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]
    );
  };

  return (
    <FieldWrapper label={field.label} required={field.required} error={error}>
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((opt) => {
          const selected = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                selected
                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </FieldWrapper>
  );
}