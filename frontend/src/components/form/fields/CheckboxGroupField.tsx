import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: string[];
    onChange: (value: string[]) => void;
    onBlur?: () => void;
    error?: string;
}

/** CHECKBOX with options: several choices, all visible (vs. MULTI_SELECT's dropdown). */
export default function CheckboxGroupField({field, value, onChange, onBlur, error}: Props) {
    const toggle = (opt: string) => {
        onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
        onBlur?.();
    };
    return (
        <FieldWrapper label={field.label} required={field.required} description={field.description} error={error}>
            <div className="flex flex-col gap-2">
                {(field.options ?? []).map(opt => {
                    const checked = value.includes(opt);
                    return (
                        <label
                            key={opt}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                                checked
                                    ? "border-[#D8DCF5] bg-[#EEF0FB]"
                                    : error
                                        ? "border-[#EAD4D3] bg-[#F7EEEE] hover:border-[#E0B8B6]"
                                        : "border-[#E4E4E7] bg-white hover:border-[#D4D4D9] hover:bg-[#FAFAFB]"
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(opt)}
                                className="h-4 w-4 accent-[#3730A3]"
                            />
                            <span className="text-sm text-[#55555F]">{opt}</span>
                        </label>
                    );
                })}
            </div>
        </FieldWrapper>
    );
}
