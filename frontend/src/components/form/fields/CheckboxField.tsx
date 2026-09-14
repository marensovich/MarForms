import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: boolean;
    onChange: (value: boolean) => void;
    onBlur?: () => void;
    error?: string;
}

export default function CheckboxField({field, value, onChange, onBlur, error}: Props) {
    return (
        <FieldWrapper label={field.label} required={field.required} description={field.description} error={error}>
            <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors hover:border-[#D4D4D9] ${
                    error
                        ? "border-[#EAD4D3] bg-[#F7EEEE]"
                        : "border-[#E4E4E7] bg-white"
                }`}>
                <input
                    type="checkbox"
                    checked={value}
                    onChange={e => {
                        onChange(e.target.checked);
                        onBlur?.();
                    }}
                    className="h-4 w-4 accent-[#3730A3]"
                />
                <span className="text-sm text-[#6B6B76]">{field.label}</span>
            </label>
        </FieldWrapper>
    );
}
