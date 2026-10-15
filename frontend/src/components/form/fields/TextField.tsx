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

const PLACEHOLDER_KEYS: Partial<Record<FormField["type"], string>> = {
    TEXT: "form.placeholder.text",
    TEXTAREA: "form.placeholder.textarea",
    NUMBER: "form.placeholder.number",
    EMAIL: "form.placeholder.email",
    URL: "form.placeholder.url",
    PHONE: "form.placeholder.phone",
};

// Integer.MAX_VALUE — actual backend TEXT column upper bound
const TEXTAREA_MAX_LENGTH = 2_147_483_647;

function fieldTypeToInputType(type: FormField["type"]): string {
    const map: Partial<Record<FormField["type"], string>> = {
        TEXT: "text",
        NUMBER: "text",   // use text + onChange filter to block non-numeric chars
        EMAIL: "email",
        PASSWORD: "password",
        URL: "url",
        PHONE: "tel",
        DATE: "date",
        TIME: "time",
        DATETIME: "datetime-local",
    };
    return map[type] ?? "text";
}

// Strips anything that isn't a digit, leading minus, or decimal point.
function filterNumber(raw: string): string {
    const sign = raw.startsWith("-") ? "-" : "";
    const digits = raw.replace(/[^0-9.]/g, "");
    const parts = digits.split(".");
    return sign + (parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : digits);
}

// ── Phone auto-formatter ───────────────────────────────────────────────────

function formatPhone(input: string): string {
    let digits = input.replace(/\D/g, "");
    if (!digits) return "";

    if (digits[0] === "8") digits = "7" + digits.slice(1);
    else if (digits[0] !== "7") digits = "7" + digits;
    digits = digits.slice(0, 11);

    const d = digits.split("");
    let out = "+7";
    if (d.length > 1) out += " (" + d.slice(1, 4).join("");
    if (d.length > 3) out += ") " + d.slice(4, 7).join("");
    if (d.length > 6) out += "-" + d.slice(7, 9).join("");
    if (d.length > 8) out += "-" + d.slice(9, 11).join("");

    return out;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TextField({field, value, onChange, onBlur, error}: Props) {
    const {t} = useTranslation();
    const isTextarea = field.type === "TEXTAREA";
    const isPhone = field.type === "PHONE";
    const isNumber = field.type === "NUMBER";
    const isText = field.type === "TEXT";

    const placeholderKey = PLACEHOLDER_KEYS[field.type];
    const placeholder = field.placeholder ?? (placeholderKey ? t(placeholderKey) : "");

    const handleChange = (raw: string) => {
        if (isPhone) onChange(formatPhone(raw));
        else if (isNumber) onChange(filterNumber(raw));
        else onChange(raw);
    };

    // Counter or range hint, shown only when the form's author set a limit: "58 / 2000 · минимум 200".
    let counter: React.ReactNode = null;
    if (isText || isTextarea) {
        const parts: string[] = [];
        if (field.max != null) parts.push(`${value.length} / ${field.max.toLocaleString()}`);
        if (field.min != null) parts.push(t("form.counter.minChars", {min: field.min}));
        if (parts.length) {
            const over = field.max != null && value.length > field.max;
            counter = <span className={over ? "text-rdt" : undefined}>{parts.join(" · ")}</span>;
        }
    }
    if (isNumber && (field.min != null || field.max != null)) {
        const parts: string[] = [];
        if (field.min != null) parts.push(t("form.counter.min", {min: field.min}));
        if (field.max != null) parts.push(t("form.counter.max", {max: field.max}));
        counter = parts.join(" · ");
    }

    const ids = fieldIds(field.id);
    const common = {
        id: ids.input,
        value,
        onBlur,
        placeholder,
        required: field.required,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy(field.id, !!field.description, !!error),
    };

    return (
        <FieldWrapper fieldId={field.id} label={field.label} required={field.required} description={field.description}
                      error={error} counter={counter}>
            {isTextarea ? (
                <textarea {...common} onChange={e => handleChange(e.target.value)} rows={4}
                          maxLength={field.max != null ? field.max : TEXTAREA_MAX_LENGTH}
                          className={inputClass(error, "min-h-[112px] resize-y py-3 leading-normal sm:py-2.5")}/>
            ) : (
                <input {...common} type={fieldTypeToInputType(field.type)} onChange={e => handleChange(e.target.value)}
                       inputMode={isPhone ? "tel" : isNumber ? "decimal" : undefined}
                       maxLength={isText ? (field.max != null ? field.max : 255) : undefined}
                       className={inputClass(error)}/>
            )}
        </FieldWrapper>
    );
}
