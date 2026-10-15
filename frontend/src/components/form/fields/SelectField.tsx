import {useTranslation} from "react-i18next";
import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";
import {describedBy, fieldIds, inputClass} from "./fieldStyles";

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    error?: string;
}

export default function SelectField({field, value, onChange, onBlur, error}: Props) {
    const {t} = useTranslation();
    return (
        <FieldWrapper fieldId={field.id} label={field.label} required={field.required} description={field.description} error={error}>
            <select id={fieldIds(field.id).input} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}
                    required={field.required} aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy(field.id, !!field.description, !!error)}
                    className={inputClass(error, "h-12 px-2.5 sm:h-[42px]")}>
                <option value="" disabled>{t("form.placeholder.select")}</option>
                {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </FieldWrapper>
    );
}
