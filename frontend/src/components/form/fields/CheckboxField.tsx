import {useTranslation} from "react-i18next";
import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";
import {cx} from "../../../ui";
import {describedBy, fieldIds} from "./fieldStyles";

interface Props {
    field: FormField;
    value: boolean;
    onChange: (value: boolean) => void;
    onBlur?: () => void;
    error?: string;
}

/** Yes / no as a switch with its answer next to it (FormDesktop.dc.html — «Был ли опыт…»). */
export default function CheckboxField({field, value, onChange, onBlur, error}: Props) {
    const {t} = useTranslation();
    return (
        <FieldWrapper fieldId={field.id} label={field.label} required={field.required} description={field.description} error={error}>
            <div className="flex items-center gap-3">
                <button id={fieldIds(field.id).input} type="button" role="switch" aria-checked={value}
                        aria-invalid={error ? true : undefined} aria-describedby={describedBy(field.id, !!field.description, !!error)}
                        onClick={() => {
                            onChange(!value);
                            onBlur?.();
                        }}
                        className={cx("mf-hit flex h-6 w-11 flex-none rounded-full p-0.5 transition-colors",
                            "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs",
                            value ? "justify-end bg-pr" : "justify-start bg-bd", error && !value && "ring-[1.5px] ring-dg")}>
                    <span className="h-5 w-5 rounded-full bg-white shadow-sm"/>
                </button>
                <span className="text-[15px] font-medium text-tx" aria-hidden="true">{value ? t("form.yes") : t("form.no")}</span>
            </div>
        </FieldWrapper>
    );
}
