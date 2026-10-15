import {useCallback, useEffect, useRef, useState} from "react";
import type {FormAnswers, FormField} from "../../types/forms";
import {clearDraft, loadDraft, saveDraft} from "./draft";

/**
 * The browser draft of a form's answers (#113): initial answers from the draft,
 * a debounced save after each change, and the last save time for the status line.
 * Disabled (no storage at all) for the builder preview.
 */
export function useFormDraft(formId: string, fields: FormField[], enabled: boolean) {
    const [initial] = useState(() => enabled ? loadDraft(formId, fields) : null);
    const [savedAt, setSavedAt] = useState<Date | null>(initial?.savedAt ?? null);
    const timer = useRef<number | undefined>(undefined);

    const schedule = useCallback((answers: FormAnswers) => {
        if (!enabled) return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setSavedAt(saveDraft(formId, fields, answers)), 500);
    }, [enabled, formId, fields]);

    const clear = useCallback(() => {
        window.clearTimeout(timer.current);
        clearDraft(formId);
        setSavedAt(null);
    }, [formId]);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    return {initialAnswers: initial?.answers ?? {}, restored: initial !== null, savedAt, schedule, clear};
}
