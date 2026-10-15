import {
    cloneElement,
    forwardRef,
    isValidElement,
    type InputHTMLAttributes,
    type ReactElement,
    type ReactNode,
    type SelectHTMLAttributes,
    type TextareaHTMLAttributes,
    useId,
} from "react";
import {FiAlertCircle} from "react-icons/fi";
import {cx} from "./cx";

// Docs: docs/design/mockups/Components.dc.html — "Поля ввода".
const CONTROL = cx(
    "w-full rounded-[10px] border border-bd bg-sf px-3 font-sans text-sm text-tx placeholder:text-mu/70 transition-colors",
    "focus:border-pr focus:outline focus:outline-[3px] focus:outline-prs",
    "aria-[invalid=true]:border-dg aria-[invalid=true]:focus:outline-rdb",
    "disabled:cursor-not-allowed disabled:bg-s2 disabled:text-mu",
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
    {className, ...rest}, ref) {
    return <input ref={ref} className={cx(CONTROL, "h-10", className)} {...rest}/>;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    /** Shows "n / max" under the field when maxLength is set. */
    counter?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    {className, counter = true, maxLength, value, ...rest}, ref) {
    const length = typeof value === "string" ? value.length : 0;
    return (
        <div className="flex flex-col gap-1">
            <textarea ref={ref} maxLength={maxLength} value={value}
                      className={cx(CONTROL, "min-h-[96px] py-2.5 leading-relaxed", className)} {...rest}/>
            {counter && maxLength && (
                <span className="self-end text-xs tabular-nums text-mu" aria-hidden="true">{length} / {maxLength}</span>
            )}
        </div>
    );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
    {className, children, ...rest}, ref) {
    return <select ref={ref} className={cx(CONTROL, "h-10 px-2.5", className)} {...rest}>{children}</select>;
});

export interface FieldProps {
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    required?: boolean;
    className?: string;
    /** A single control; it receives id, aria-describedby and aria-invalid. */
    children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean; required?: boolean }>;
}

/** Label + control + hint/error, wired for screen readers (ТЗ 8.4: errors are tied to fields). */
export function Field({label, hint, error, required, className, children}: FieldProps) {
    const autoId = useId();
    const id = (isValidElement(children) && children.props.id) || autoId;
    const hintId = hint && !error ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
    return (
        <div className={cx("flex flex-col gap-1.5", className)}>
            <label htmlFor={id} className="text-[13px] font-semibold text-tx">
                {label}{required && <span className="ml-0.5 text-rdt" aria-hidden="true">*</span>}
            </label>
            {cloneElement(children, {id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, required})}
            {hint && !error && <span id={hintId} className="text-xs text-mu">{hint}</span>}
            {error && (
                <span id={errorId} className="flex items-center gap-1 text-xs font-medium text-rdt">
                    <FiAlertCircle size={12} aria-hidden="true" className="flex-none"/>{error}
                </span>
            )}
        </div>
    );
}
