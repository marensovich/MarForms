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
                className={`flex flex-wrap gap-2 rounded-xl p-0.5 transition-colors ${error ? "ring-1 ring-[#B56A65]/30" : ""}`}>
                {(field.options ?? []).map(opt => {
                    const selected = value.includes(opt);
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => toggle(opt)}
                            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                                selected
                                    ? "border-[#3730A3] bg-[#EEF0FB] text-[#3730A3]"
                                    : error
                                        ? "border-[#EAD4D3] bg-[#F7EEEE] text-[#8B4A46] hover:border-[#E0B8B6]"
                                        : "border-[#E4E4E7] bg-white text-[#6B6B76] hover:border-[#D4D4D9] hover:text-[#1E1E24]"
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
