import type {FieldType, FormAnswers, FormField} from "../../types/forms";
import {isInputField} from "../../types/forms";

// Layout rules of the public form (ТЗ 3.3, docs/design/mockups/FormDesktop.dc.html), kept pure for tests.

export interface FormSection {
    /** The "Раздел" field heading the group; null for fields before the first one. */
    heading: FormField | null;
    /** 1-based among headed sections. */
    number: number;
    fields: FormField[];
}

/** Splits the fields by their section breaks (ФТ-3.3.4). */
export function groupSections(fields: FormField[]): FormSection[] {
    const sections: FormSection[] = [];
    let current: FormSection | null = null;
    let number = 0;
    for (const field of fields) {
        if (field.type === "SECTION_BREAK") {
            current = {heading: field, number: ++number, fields: []};
            sections.push(current);
        } else {
            if (!current) {
                current = {heading: null, number: 0, fields: []};
                sections.push(current);
            }
            current.fields.push(field);
        }
    }
    return sections;
}

/** One-line inputs sit two per row from 640 px; everything else takes the full width. */
const SHORT: FieldType[] = ["TEXT", "NUMBER", "EMAIL", "PHONE", "URL", "PASSWORD", "SELECT", "DATE", "TIME", "DATETIME"];

export type FormRow = { kind: "pair"; fields: FormField[] } | { kind: "single"; field: FormField };

/** Packs consecutive short, unconditional fields into pairs (a lone one stays in its own row). */
export function layoutRows(fields: FormField[]): FormRow[] {
    const rows: FormRow[] = [];
    let pending: FormField[] = [];
    const flush = () => {
        for (let i = 0; i < pending.length; i += 2) {
            const pair = pending.slice(i, i + 2);
            rows.push(pair.length === 2 ? {kind: "pair", fields: pair} : {kind: "single", field: pair[0]});
        }
        pending = [];
    };
    for (const field of fields) {
        if (SHORT.includes(field.type) && !field.condition) {
            pending.push(field);
        } else {
            flush();
            rows.push({kind: "single", field});
        }
    }
    flush();
    return rows;
}

/** Seconds a respondent typically spends per field type. */
const SECONDS: Partial<Record<FieldType, number>> = {
    TEXT: 20, NUMBER: 10, EMAIL: 15, PHONE: 15, URL: 20, PASSWORD: 15,
    TEXTAREA: 90, SELECT: 10, RADIO: 10, CHECKBOX: 10, MULTI_SELECT: 15, BOOLEAN: 5,
    DATE: 15, TIME: 10, DATETIME: 20, RATING: 5, FILE_UPLOAD: 40,
};

/** "≈ 8 минут" badge (ФТ-3.3.2): rounded up, at least a minute. */
export function estimateMinutes(fields: FormField[]): number {
    const seconds = fields.reduce((sum, f) => sum + (SECONDS[f.type] ?? 0), 0);
    return Math.max(1, Math.ceil(seconds / 60));
}

export function isAnswered(value: FormAnswers[string] | undefined): boolean {
    if (value === undefined || value === null || value === "" || value === false) return false;
    return !(Array.isArray(value) && value.length === 0);
}

export interface FillProgress {
    /** 1-based section the respondent is in: the first one with an unanswered field. */
    section: number;
    sections: number;
    answered: number;
    total: number;
}

/** "Раздел 2 из 3 · 7 из 12 полей" over the fields shown right now (ФТ-3.3.3). */
export function fillProgress(sections: FormSection[], answers: FormAnswers, visible: Set<string>): FillProgress {
    const headed = sections.filter(s => s.heading).length;
    let answered = 0, total = 0, section = 0;
    sections.forEach((s, i) => {
        const inputs = s.fields.filter(f => isInputField(f) && visible.has(f.id));
        const done = inputs.filter(f => isAnswered(answers[f.id])).length;
        answered += done;
        total += inputs.length;
        if (!section && done < inputs.length) section = s.heading ? s.number : 1;
        if (!section && i === sections.length - 1) section = s.heading ? s.number : 1;
    });
    return {section: Math.max(1, section), sections: Math.max(1, headed), answered, total};
}

/** A long form gets the sticky progress bar: several sections or many fields. */
export function isLongForm(sections: FormSection[]): boolean {
    return sections.filter(s => s.heading).length > 1 || sections.flatMap(s => s.fields).filter(isInputField).length >= 8;
}
