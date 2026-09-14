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
                className={`flex flex-col gap-2 rounded-xl transition-colors ${error ? "ring-1 ring-[#B56A65]/30" : ""}`}>
                {(field.options ?? []).map(opt => (
                    <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                            value === opt
                                ? "border-[#D8DCF5] bg-[#EEF0FB]"
                                : error
                                    ? "border-[#EAD4D3] bg-[#F7EEEE] hover:border-[#E0B8B6]"
                                    : "border-[#E4E4E7] bg-white hover:border-[#D4D4D9] hover:bg-[#FAFAFB]"
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
                            className="accent-[#3730A3]"
                        />
                        <span className="text-sm text-[#55555F]">{opt}</span>
                    </label>
                ))}
            </div>
        </FieldWrapper>
    );
}
