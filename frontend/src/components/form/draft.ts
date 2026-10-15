import type {FormAnswers, FormField} from "../../types/forms";

/**
 * Answers draft of a public form kept in the browser (ТЗ ФТ-3.3.8, #113): restored
 * when the link is opened again, cleared after a successful submission. Files are
 * never kept (only references to uploads that expire). Nothing goes to the server —
 * for an anonymous form too. Storage errors (private mode) are ignored.
 */

const PREFIX = "marforms.draft.";

interface StoredDraft {
    savedAt: string;
    /** Field id → [field type, value]: a value is restored only into a field of the same type. */
    answers: Record<string, [string, FormAnswers[string]]>;
}

export function draftKey(formId: string): string {
    return PREFIX + formId;
}

const KEPT = (field: FormField) => field.type !== "FILE_UPLOAD" && field.type !== "SECTION_BREAK" && field.type !== "PASSWORD";

function isEmpty(value: FormAnswers[string] | undefined): boolean {
    return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

/** Stores the answers; returns the save time, or null if nothing was stored. */
export function saveDraft(formId: string, fields: FormField[], answers: FormAnswers, now = new Date()): Date | null {
    const kept: StoredDraft["answers"] = {};
    for (const field of fields) {
        if (!KEPT(field) || isEmpty(answers[field.id])) continue;
        kept[field.id] = [field.type, answers[field.id]];
    }
    try {
        if (Object.keys(kept).length === 0) {
            localStorage.removeItem(draftKey(formId));
            return null;
        }
        localStorage.setItem(draftKey(formId), JSON.stringify({savedAt: now.toISOString(), answers: kept} satisfies StoredDraft));
        return now;
    } catch {
        return null;
    }
}

/**
 * The stored answers that still fit the form: same field id and type, and for
 * choice fields only options that still exist. A changed form keeps what it can.
 */
export function loadDraft(formId: string, fields: FormField[]): { answers: FormAnswers; savedAt: Date } | null {
    let stored: StoredDraft;
    try {
        const raw = localStorage.getItem(draftKey(formId));
        if (!raw) return null;
        stored = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!stored || typeof stored !== "object" || !stored.answers) return null;
    const answers: FormAnswers = {};
    for (const field of fields) {
        const entry = stored.answers[field.id];
        if (!entry || !KEPT(field) || entry[0] !== field.type) continue;
        const value = fitToOptions(field, entry[1]);
        if (!isEmpty(value)) answers[field.id] = value!;
    }
    if (Object.keys(answers).length === 0) return null;
    const savedAt = new Date(stored.savedAt);
    return {answers, savedAt: isNaN(savedAt.getTime()) ? new Date() : savedAt};
}

export function clearDraft(formId: string) {
    try {
        localStorage.removeItem(draftKey(formId));
    } catch {
        // Nothing to clear without storage.
    }
}

function fitToOptions(field: FormField, value: FormAnswers[string]): FormAnswers[string] | undefined {
    const options = field.options;
    if (!options || options.length === 0) return value;
    if (Array.isArray(value)) return value.filter(v => options.includes(v));
    if (typeof value === "string" && (field.type === "SELECT" || field.type === "RADIO")) {
        return options.includes(value) ? value : undefined;
    }
    return value;
}
