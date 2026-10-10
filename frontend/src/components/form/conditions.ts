import type {FieldCondition, FormAnswers, FormField} from "../../types/forms";

/*
 * Branching (E3.1): which fields are shown for the current answers.
 * Mirrors backend FormConditions.java — keep the two in step, or a
 * respondent could be asked for a field the server then ignores (or the
 * reverse).
 */

function scalar(v: unknown): string | null {
    if (v === null || v === undefined || v === false) return null;
    if (typeof v === "number") {
        if (!Number.isFinite(v)) return null;
        return String(v);
    }
    const s = String(v).trim();
    return s === "" ? null : s;
}

/** An answer as strings: none when empty, one per chosen option for a multi-choice. */
export function answerStrings(answer: FormAnswers[string] | undefined): string[] {
    if (Array.isArray(answer)) {
        return answer.map(scalar).filter((s): s is string => s !== null);
    }
    const s = scalar(answer);
    return s === null ? [] : [s];
}

function parseNumber(s: string): number | null {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

export function conditionMatches(condition: FieldCondition, answer: FormAnswers[string] | undefined): boolean {
    if (!condition.operator) return true;
    const values = answerStrings(answer);
    const expected = (condition.value ?? "").trim();
    const lower = expected.toLowerCase();
    switch (condition.operator) {
        case "EMPTY":
            return values.length === 0;
        case "NOT_EMPTY":
            return values.length > 0;
        case "EQUALS":
            return values.some(v => v.toLowerCase() === lower);
        case "NOT_EQUALS":
            return !values.some(v => v.toLowerCase() === lower);
        case "CONTAINS":
            return values.some(v => v.toLowerCase().includes(lower));
        case "GREATER_THAN":
        case "LESS_THAN": {
            if (values.length === 0) return false;
            const actual = parseNumber(values[0]);
            const threshold = parseNumber(expected);
            if (actual === null || threshold === null) return false;
            return condition.operator === "GREATER_THAN" ? actual > threshold : actual < threshold;
        }
    }
}

/** Ids of the fields shown for these answers; hiding a field hides its dependants too. */
export function visibleFieldIds(fields: FormField[], answers: FormAnswers): Set<string> {
    const byId = new Map(fields.map(f => [f.id, f]));
    const memo = new Map<string, boolean>();

    const isVisible = (id: string, visiting: Set<string>): boolean => {
        const known = memo.get(id);
        if (known !== undefined) return known;
        const field = byId.get(id);
        if (!field) return false;
        const c = field.condition;
        let result: boolean;
        if (!c) {
            result = true;
        } else if (visiting.has(id)) {
            result = false; // a loop: the server rejects these on save
        } else {
            visiting.add(id);
            const controllerVisible = !!c.fieldId && isVisible(c.fieldId, visiting);
            result = conditionMatches(c, controllerVisible ? answers[c.fieldId] : undefined);
            visiting.delete(id);
        }
        memo.set(id, result);
        return result;
    };

    return new Set(fields.filter(f => isVisible(f.id, new Set())).map(f => f.id));
}
