import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: string[];
    onChange: (value: string[]) => void;
    onBlur?: () => void;
    error?: string;
}

export default function MultiSelectField({field, value, onChange, onBlur, error}: Props) {
    const toggle = (opt: string) => {
        const next = value.includes(opt)
            ? value.filter(v => v !== opt)
            : [...value, opt];
        onChange(next);
        onBlur?.();
    };

    return (
        <FieldWrapper label={field.label} required={field.required} description={field.description} error={error}>
            <div
                className={`flex flex-wrap gap-2 rounded-xl p-0.5 transition-colors ${error ? "ring-1 ring-red-500/30" : ""}`}>
                {(field.options ?? []).map(opt => {
                    const selected = value.includes(opt);
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => toggle(opt)}
                            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                                selected
                                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                                    : error
                                        ? "border-red-500/25 bg-red-500/[0.04] text-white/50 hover:border-red-500/40 hover:text-white/70"
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
