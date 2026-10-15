import type {ReactNode} from "react";
import {FiAlertCircle} from "react-icons/fi";
import {fieldIds} from "./fieldStyles";

interface FieldWrapperProps {
    fieldId: string;
    label: string;
    required: boolean;
    error?: string;
    description?: string;
    counter?: ReactNode;
    /** Several controls (radio, checkboxes, rating): a fieldset with a legend instead of a label. */
    group?: boolean;
    children: ReactNode;
}

/**
 * Label, description, control and error of a public form field (FormDesktop.dc.html).
 * The error is red text with an icon under the field and is tied to it for screen
 * readers; the label names the control (ТЗ ФТ-3.3.5, 8.4).
 */
export default function FieldWrapper({fieldId, label, required, error, description, counter, group, children}: FieldWrapperProps) {
    const ids = fieldIds(fieldId);
    const title = (
        <>
            {label}
            {required && <span className="ml-1 text-rdt" aria-hidden="true">*</span>}
        </>
    );
    const body = (
        <>
            {description && <p id={ids.description} className="m-0 text-[13px] font-normal leading-snug text-mu">{description}</p>}
            {children}
            {(error || counter) && (
                <div className="flex min-h-[16px] items-start justify-between gap-2">
                    {error
                        ? <p id={ids.error} className="m-0 flex items-center gap-1.5 text-xs font-medium text-rdt">
                            <FiAlertCircle size={12} className="flex-none" aria-hidden="true"/>{error}
                        </p>
                        : <span/>}
                    {counter && <div className="flex-none text-xs font-medium tabular-nums text-mu">{counter}</div>}
                </div>
            )}
        </>
    );

    if (group) {
        return (
            <fieldset id={`field-${fieldId}`} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
                      aria-required={required || undefined} aria-invalid={error ? true : undefined}
                      aria-describedby={error ? ids.error : undefined}>
                <legend className="mb-1.5 p-0 text-[15px] font-semibold text-tx sm:text-sm">{title}</legend>
                {body}
            </fieldset>
        );
    }
    return (
        <div id={`field-${fieldId}`} className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={ids.input} className="text-[15px] font-semibold text-tx sm:text-sm">{title}</label>
            {body}
        </div>
    );
}
