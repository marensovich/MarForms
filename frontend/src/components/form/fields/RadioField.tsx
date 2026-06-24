import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    error?: string;
}

export default function RadioField({field, value, onChange, onBlur, error}: Props) {
    return (
        <FieldWrapper label={field.label} required={field.required} description={field.description} error={error}>
            <div
                className={`flex flex-col gap-2 rounded-xl transition-colors ${error ? "ring-1 ring-red-500/30" : ""}`}>
                {(field.options ?? []).map(opt => (
                    <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                            value === opt
                                ? "border-indigo-500/40 bg-indigo-500/[0.08]"
                                : error
                                    ? "border-red-500/20 bg-red-500/[0.02] hover:border-red-500/30"
                                    : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.05]"
                        }`}
                    >
                        <input
                            type="radio"
                            name={field.id}
                            value={opt}
                            checked={value === opt}
                            onChange={() => {
                                onChange(opt);
                                onBlur?.();
                            }}
                            className="accent-indigo-500"
                        />
                        <span className="text-sm text-white/80">{opt}</span>
                    </label>
                ))}
            </div>
        </FieldWrapper>
    );
}
