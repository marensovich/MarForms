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
                className={`w-full rounded-xl border px-4 py-3 text-sm text-tx outline-none transition-colors focus:ring-1 ${
                    error
                        ? "border-rdb bg-rdb focus:border-rdt focus:ring-rdt/20"
                        : "border-bd bg-bg focus:border-pr focus:ring-pr/20"
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
