import type {IconType} from "react-icons";
import {
    FiAlignLeft,
    FiCalendar,
    FiCheckSquare,
    FiChevronDown,
    FiCircle,
    FiClock,
    FiHash,
    FiLayers,
    FiLink,
    FiMail,
    FiMinus,
    FiPaperclip,
    FiPhone,
    FiStar,
    FiToggleLeft,
    FiType,
} from "react-icons/fi";
import type {FieldType, FormField} from "../../types/forms";

// Docs: ТЗ 3.4 (types and their limits), 5.3; docs/design/mockups/FormEdit.dc.html.

export const TYPE_ICON: Record<FieldType, IconType> = {
    TEXT: FiType,
    TEXTAREA: FiAlignLeft,
    NUMBER: FiHash,
    EMAIL: FiMail,
    PASSWORD: FiType,
    URL: FiLink,
    PHONE: FiPhone,
    SELECT: FiChevronDown,
    MULTI_SELECT: FiLayers,
    RADIO: FiCircle,
    CHECKBOX: FiCheckSquare,
    BOOLEAN: FiToggleLeft,
    DATE: FiCalendar,
    TIME: FiClock,
    DATETIME: FiCalendar,
    RATING: FiStar,
    FILE_UPLOAD: FiPaperclip,
    SECTION_BREAK: FiMinus,
};

/** «+ Добавить поле»: every type of ТЗ 3.4, in its order. */
export const PALETTE: FieldType[] = [
    "TEXT", "TEXTAREA", "NUMBER", "EMAIL", "PHONE", "URL", "DATE", "TIME", "DATETIME",
    "SELECT", "RADIO", "CHECKBOX", "MULTI_SELECT", "BOOLEAN", "RATING", "FILE_UPLOAD", "SECTION_BREAK",
];

export const WITH_OPTIONS: FieldType[] = ["SELECT", "MULTI_SELECT", "RADIO", "CHECKBOX"];
export const WITH_LENGTH: FieldType[] = ["TEXT", "TEXTAREA"];
export const WITH_SELECTED: FieldType[] = ["MULTI_SELECT", "CHECKBOX"];
export const WITH_RANGE: FieldType[] = ["DATE", "TIME", "DATETIME"];
export const WITH_PLACEHOLDER: FieldType[] = ["TEXT", "TEXTAREA", "NUMBER", "EMAIL", "URL", "PHONE"];

/** A new field with the defaults of ТЗ 3.4: two options to start a choice, PNG/JPG/PDF up to 5 MB × 3 for files. */
export function newField(type: FieldType, label: string, option: (n: number) => string): FormField {
    const field: FormField = {id: `f_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`, type, label, required: false};
    if (WITH_OPTIONS.includes(type)) field.options = [option(1), option(2)];
    if (type === "FILE_UPLOAD") {
        field.allowedExtensions = ["png", "jpg", "pdf"];
        field.maxFileSizeMb = 5;
        field.maxFiles = 3;
    }
    return field;
}

/** What is wrong with a field before the server says it: shown in the list and blocking the wizard's step. */
export function fieldProblem(field: FormField): string | null {
    if (!field.label.trim()) return "label";
    if (WITH_OPTIONS.includes(field.type)) {
        const options = (field.options ?? []).map(o => o.trim()).filter(Boolean);
        if (options.length < 2) return "options";
        if (new Set(options).size !== options.length) return "optionsUnique";
    }
    const lo = field.minLength ?? field.min;
    const hi = field.maxLength ?? field.max;
    if (WITH_LENGTH.includes(field.type) && lo != null && hi != null && lo > hi) return "range";
    if (field.type === "NUMBER" && field.min != null && field.max != null && field.min > field.max) return "range";
    if (field.minSelected != null && field.maxSelected != null && field.minSelected > field.maxSelected) return "range";
    if (field.minDate && field.maxDate && field.minDate > field.maxDate) return "range";
    return null;
}
