import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";
import {optionCardClass} from "./fieldStyles";

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    error?: string;
}

/** One answer as option cards, two per row from 640 px (FormDesktop.dc.html — «Желаемый отдел»). */
export default function RadioField({field, value, onChange, onBlur, error}: Props) {
    return (
        <FieldWrapper fieldId={field.id} label={field.label} required={field.required} description={field.description} error={error} group>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(field.options ?? []).map(opt => (
                    <label key={opt} className={optionCardClass(value === opt)}>
                        <input type="radio" name={field.id} value={opt} checked={value === opt} required={field.required}
                               onChange={() => {
                                   onChange(opt);
                                   onBlur?.();
                               }}
                               className="h-4 w-4 flex-none accent-pr focus:outline-none"/>
                        {opt}
                    </label>
                ))}
            </div>
        </FieldWrapper>
    );
}
