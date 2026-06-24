import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    error?: string;
}

const DEFAULT_PLACEHOLDER: Partial<Record<FormField["type"], string>> = {
    TEXT: "Type your answer…",
    TEXTAREA: "Write your answer here…",
    NUMBER: "Enter a number…",
    EMAIL: "you@example.com",
    URL: "https://example.com",
    PHONE: "+7 (___) ___-__-__",
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
    // Allow optional leading minus, then digits and at most one dot
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
    const isTextarea = field.type === "TEXTAREA";
    const isPhone = field.type === "PHONE";
    const isNumber = field.type === "NUMBER";
    const isText = field.type === "TEXT";

    const placeholder = field.placeholder ?? DEFAULT_PLACEHOLDER[field.type] ?? "";

    const baseCls = "w-full rounded-xl border px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors focus:ring-1";
    const normalCls = "border-white/[0.08] bg-white/[0.04] focus:border-indigo-500/60 focus:bg-white/[0.06] focus:ring-indigo-500/30";
    const errorCls = "border-red-500/50 bg-red-500/[0.04] focus:border-red-500/60 focus:ring-red-500/20";
    const inputCls = `${baseCls} ${error ? errorCls : normalCls}`;

    const handleChange = (raw: string) => {
        if (isPhone) {
            onChange(formatPhone(raw));
            return;
        }
        if (isNumber) {
            onChange(filterNumber(raw));
            return;
        }
        onChange(raw);
    };

    // ── Counter / range hint (shown only when creator explicitly set the limit) ──

    let counter: React.ReactNode = null;

    if (isText || isTextarea) {
        if (field.max != null) {
            const len = value.length;
            const near = len > field.max * 0.85;
            const over = len > field.max;
            counter = (
                <span className={`text-[10px] tabular-nums transition-colors ${
                    over ? "text-red-400" : near ? "text-amber-400/80" : "text-white/20"
                }`}>
                    {len} / {field.max.toLocaleString()}
                </span>
            );
        } else if (field.min != null) {
            counter = (
                <span className="text-[10px] text-white/20">min {field.min} chars</span>
            );
        }
    }

    if (isNumber && (field.min != null || field.max != null)) {
        const parts: string[] = [];
        if (field.min != null) parts.push(`min ${field.min}`);
        if (field.max != null) parts.push(`max ${field.max}`);
        counter = <span className="text-[10px] text-white/20">{parts.join(" · ")}</span>;
    }

    return (
        <FieldWrapper
            label={field.label}
            required={field.required}
            description={field.description}
            error={error}
            counter={counter}
        >
            {isTextarea ? (
                <textarea
                    value={value}
                    onChange={e => handleChange(e.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    rows={4}
                    maxLength={field.max != null ? field.max : TEXTAREA_MAX_LENGTH}
                    className={`${inputCls} resize-none`}
                />
            ) : (
                <input
                    type={fieldTypeToInputType(field.type)}
                    value={value}
                    onChange={e => handleChange(e.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    inputMode={isPhone ? "tel" : isNumber ? "decimal" : undefined}
                    maxLength={isText ? (field.max != null ? field.max : 255) : undefined}
                    className={inputCls}
                />
            )}
        </FieldWrapper>
    );
}
