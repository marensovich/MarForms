import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    error?: string;
}

export default function SelectField({field, value, onChange, onBlur, error}: Props) {
    return (
        <FieldWrapper label={field.label} required={field.required} description={field.description} error={error}>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                className={`w-full rounded-xl border px-4 py-3 text-sm text-white outline-none transition-colors focus:ring-1 ${
                    error
                        ? "border-red-500/50 bg-red-500/[0.04] focus:border-red-500/60 focus:ring-red-500/20"
                        : "border-white/[0.08] bg-[#05050c] focus:border-indigo-500/60 focus:ring-indigo-500/30"
                }`}
            >
                <option value="" disabled>Select an option…</option>
                {(field.options ?? []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </FieldWrapper>
    );
}
