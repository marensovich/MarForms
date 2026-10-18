import {useTranslation} from "react-i18next";
import {FiX} from "react-icons/fi";
import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";
import {cx} from "../../../ui";
import {describedBy, fieldIds} from "./fieldStyles";

interface Props {
    field: FormField;
    value: string[];
    onChange: (value: string[]) => void;
    onBlur?: () => void;
    error?: string;
}

/** Multi-select as a chip field (FormDesktop.dc.html — «Языки общения»): chosen chips + "Добавить…". */
export default function MultiSelectField({field, value, onChange, onBlur, error}: Props) {
    const {t} = useTranslation();
    const rest = (field.options ?? []).filter(o => !value.includes(o));
    const remove = (opt: string) => {
        onChange(value.filter(v => v !== opt));
        onBlur?.();
    };
    return (
        <FieldWrapper fieldId={field.id} label={field.label} required={field.required} description={field.description} error={error}>
            <div className={cx("flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border bg-sf p-1.5 sm:min-h-[42px] sm:rounded-[10px]",
                "focus-within:border-pr focus-within:outline focus-within:outline-[3px] focus-within:outline-prs",
                error ? "border-[1.5px] border-dg" : "border-bd")}>
                {value.map(opt => (
                    <span key={opt} className="inline-flex items-center gap-1.5 rounded-[7px] bg-s2 px-2 py-1 text-[13px] text-tx">
                        {opt}
                        <button type="button" onClick={() => remove(opt)} aria-label={t("form.removeOption", {option: opt})}
                                className="mf-hit grid h-5 w-5 place-items-center rounded text-mu hover:text-tx focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr">
                            <FiX size={12} aria-hidden="true"/>
                        </button>
                    </span>
                ))}
                {rest.length > 0 && (
                    <select id={fieldIds(field.id).input} value="" onBlur={onBlur}
                            aria-invalid={error ? true : undefined} aria-describedby={describedBy(field.id, !!field.description, !!error)}
                            onChange={e => e.target.value && onChange([...value, e.target.value])}
                            className="h-11 min-w-[120px] flex-1 sm:h-8 border-0 bg-transparent px-1 text-[13px] text-mu focus:outline-none">
                        <option value="">{t("form.placeholder.add")}</option>
                        {rest.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                )}
            </div>
        </FieldWrapper>
    );
}
