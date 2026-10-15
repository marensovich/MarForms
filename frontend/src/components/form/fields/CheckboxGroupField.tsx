import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: string[];
    onChange: (value: string[]) => void;
    onBlur?: () => void;
    error?: string;
}

/** CHECKBOX with options: several choices in a row (FormDesktop.dc.html — «В какие дни вы онлайн?»). */
export default function CheckboxGroupField({field, value, onChange, onBlur, error}: Props) {
    const toggle = (opt: string) => {
        onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
        onBlur?.();
    };
    return (
        <FieldWrapper fieldId={field.id} label={field.label} required={field.required} description={field.description} error={error} group>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[15px] sm:text-sm">
                {(field.options ?? []).map(opt => (
                    <label key={opt} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-tx sm:min-h-0 sm:py-1">
                        <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} className="h-4 w-4 accent-pr"/>
                        {opt}
                    </label>
                ))}
            </div>
        </FieldWrapper>
    );
}
