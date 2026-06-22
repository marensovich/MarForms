import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}

export default function RadioField({field, value, onChange, error}: Props) {
    return (
        <FieldWrapper label={field.label} required={field.required} error={error}>
            <div className="flex flex-col gap-2">
                {(field.options ?? []).map((opt) => (
                    <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition-colors hover:border-white/20"
                    >
                        <input
                            type="radio"
                            name={field.id}
                            value={opt}
                            checked={value === opt}
                            onChange={() => onChange(opt)}
                            className="accent-indigo-500"
                        />
                        <span className="text-sm text-white/80">{opt}</span>
                    </label>
                ))}
            </div>
        </FieldWrapper>
    );
}