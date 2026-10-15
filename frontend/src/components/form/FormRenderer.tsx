import {useMemo, useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import i18n from "../../i18n";
import {type FieldType, type FormAnswers, type FormDefinition, type FormField, isInputField} from "../../types/forms";
import {DEFAULT_RATING_SCALE} from "./fields/RatingField";
import type {SubmissionReceipt} from "../../api/forms";
import {submitForm, submitPublicForm} from "../../api/forms";
import {getAnonymousToken} from "../../auth/anonymousToken";
import {visibleFieldIds} from "./conditions";
import {UploadContext} from "./fields/uploadContext";
import {ApiError} from "../../api/client";
import {describeApiError} from "../../api/errors";
import {useFormDraft} from "./useFormDraft";

/** Per-field errors from a 400 response ({"fields": {fieldId: message}}), if any. */
function fieldErrorsOf(err: unknown): Record<string, string> | null {
    if (!(err instanceof ApiError) || err.status !== 400) return null;
    try {
        const fields = JSON.parse(err.message)?.fields;
        return fields && typeof fields === "object" && Object.keys(fields).length ? fields : null;
    } catch {
        return null;
    }
}
import DynamicField from "./DynamicField";
import SectionBreak from "./fields/SectionBreak";
import {FormHeader, FormIntro, type FormMeta, SubmitBar, SuccessCard} from "./FormChrome";
import {estimateMinutes, fillProgress, groupSections, isLongForm, layoutRows} from "./layout";

// ── Validation ─────────────────────────────────────────────────────────────

function validate(form: FormDefinition, answers: FormAnswers, visible: Set<string>): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const field of form.schema.fields) {
        if (!isInputField(field) || !visible.has(field.id)) continue;
        const val = answers[field.id];
        const str = typeof val === "string" ? val.trim() : String(val ?? "");
        const isEmpty =
            val === undefined || val === null || val === false ||
            str === "" || (Array.isArray(val) && val.length === 0);

        // Required check
        if (field.required && isEmpty) {
            errors[field.id] = requiredMessage(field.type);
            continue;
        }

        // Skip type validation for empty optional fields
        if (isEmpty) continue;

        // Type-specific validation
        const typeError = validateByType(field, str, val);
        if (typeError) errors[field.id] = typeError;
    }

    return errors;
}

function requiredMessage(type: FieldType): string {
    const t = i18n.t.bind(i18n);
    switch (type) {
        case "BOOLEAN":
            return t("form.validation.requiredBoolean");
        case "SELECT":
        case "RADIO":
            return t("form.validation.requiredSelect");
        case "MULTI_SELECT":
        case "CHECKBOX":
            return t("form.validation.requiredMultiSelect");
        case "DATE":
            return t("form.validation.requiredDate");
        case "TIME":
            return t("form.validation.requiredTime");
        case "DATETIME":
            return t("form.validation.requiredDatetime");
        default:
            return t("form.validation.required");
    }
}

// Default constraints when the form creator leaves min/max unset
const FIELD_DEFAULT_MAX: Partial<Record<FieldType, number>> = {
    TEXT: 255,
    TEXTAREA: 10_000, // same default as the backend's SubmissionAnswerValidator
    NUMBER: Number.MAX_SAFE_INTEGER,
};
const FIELD_DEFAULT_MIN: Partial<Record<FieldType, number>> = {
    TEXT: 0,
    TEXTAREA: 0,
    NUMBER: Number.MIN_SAFE_INTEGER,
};

function validateByType(field: FormField, str: string, raw: FormAnswers[string]): string | null {
    const t = i18n.t.bind(i18n);
    switch (field.type) {
        case "TEXT":
        case "TEXTAREA": {
            const min = field.min ?? FIELD_DEFAULT_MIN[field.type] ?? 0;
            const max = field.max ?? FIELD_DEFAULT_MAX[field.type] ?? Infinity;
            if (str.length < min)
                return t("form.validation.minChars", {min, entered: str.length});
            if (str.length > max)
                return t("form.validation.maxChars", {max: max.toLocaleString(), entered: str.length});
            return null;
        }

        case "NUMBER": {
            const num = Number(str);
            if (str === "" || isNaN(num)) return t("form.validation.invalidNumber");
            const min = field.min ?? FIELD_DEFAULT_MIN.NUMBER!;
            const max = field.max ?? FIELD_DEFAULT_MAX.NUMBER!;
            if (num < min) return t("form.validation.minValue", {min});
            if (num > max) return t("form.validation.maxValue", {max});
            return null;
        }

        case "EMAIL":
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str))
                return t("form.validation.invalidEmail");
            return null;

        case "URL":
            try {
                new URL(str);
                return null;
            } catch {
                return t("form.validation.invalidUrl");
            }

        case "PHONE":
            if (!/^[+\d][\d\s\-().]{5,18}$/.test(str))
                return t("form.validation.invalidPhone");
            return null;

        case "SELECT":
        case "RADIO":
            if (field.options?.length && !field.options.includes(str))
                return t("form.validation.invalidOption");
            return null;

        case "MULTI_SELECT":
        case "CHECKBOX": {
            const values = Array.isArray(raw) ? raw : [str];
            if (field.options?.length && values.some(v => !field.options!.includes(v)))
                return t("form.validation.invalidOption");
            return null;
        }

        case "RATING": {
            const n = Number(raw);
            const scale = field.max ?? DEFAULT_RATING_SCALE;
            if (!Number.isInteger(n) || n < 1 || n > scale)
                return t("form.validation.invalidOption");
            return null;
        }

        case "DATE":
            if (!/^\d{4}-\d{2}-\d{2}$/.test(str) || isNaN(Date.parse(str)))
                return t("form.validation.invalidDate");
            return null;

        case "TIME":
            if (!/^\d{2}:\d{2}(:\d{2})?$/.test(str))
                return t("form.validation.invalidTime");
            return null;

        case "DATETIME":
            if (!str || isNaN(Date.parse(str)))
                return t("form.validation.invalidDatetime");
            return null;

        default:
            return null;
    }
}

/** Scrolls to a field and puts the keyboard focus on its control (ТЗ ФТ-3.3.5). */
function focusField(fieldId: string) {
    const box = document.getElementById(`field-${fieldId}`);
    box?.scrollIntoView?.({behavior: "smooth", block: "center"});
    box?.querySelector<HTMLElement>("input:not([type=hidden]):not([aria-hidden]), textarea, select, button")?.focus({preventScroll: true});
}

// ── Main renderer ──────────────────────────────────────────────────────────

interface Props {
    form: FormDefinition;
    /**
     * Builder preview (#45): renders exactly what a respondent sees and runs
     * the same validation, but never submits.
     */
    preview?: boolean;
    /** Server, closing time and limit for the header (public page only). */
    meta?: FormMeta;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function FormRenderer({form, preview = false, meta}: Props) {
    const {t} = useTranslation();
    // Browser draft of the answers (ТЗ ФТ-3.3.8, #113); none in the builder preview.
    const draft = useFormDraft(form.id, form.schema.fields, !preview);
    const [answers, setAnswers] = useState<FormAnswers>(draft.initialAnswers);
    // After the first edit, fields shown by a condition appear without the staggered intro delay.
    const [hasInteracted, setHasInteracted] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
    // One key per filled-in form, reused on every retry: if a response is
    // lost (network drop) and the user presses Submit again, the server
    // returns the original submission instead of storing a duplicate (#51).
    const idempotencyKey = useRef<string>(crypto.randomUUID());
    // Guards against a double click landing before the "submitting" state renders.
    const inFlight = useRef(false);

    // Branching (E3.1): fields hidden by their condition are not shown,
    // required, validated or sent.
    const uploadContext = useMemo(() => ({slug: form.slug ?? null, preview}), [form.slug, preview]);
    const visibleIds = useMemo(() => visibleFieldIds(form.schema.fields, answers), [form.schema.fields, answers]);
    const visibleFields = useMemo(
        () => form.schema.fields.filter(f => visibleIds.has(f.id)),
        [form.schema.fields, visibleIds]
    );

    const requiredFields = useMemo(
        () => visibleFields.filter(f => f.required && isInputField(f)),
        [visibleFields]
    );

    // Sections, the sticky progress of long forms and the time estimate (ТЗ 3.3, #112).
    const sections = useMemo(() => groupSections(form.schema.fields), [form.schema.fields]);
    const sectionCount = sections.filter(s => s.heading).length;
    const progress = isLongForm(sections) ? fillProgress(sections, answers, visibleIds) : null;
    const minutes = useMemo(() => estimateMinutes(form.schema.fields), [form.schema.fields]);

    // Shared per-field validation used by both handleChange and handleBlur
    const revalidateField = (fieldId: string, value: FormAnswers[string]) => {
        const field = form.schema.fields.find(f => f.id === fieldId);
        if (!field) return;
        const str = typeof value === "string" ? value.trim() : String(value ?? "");
        const isEmpty = value === undefined || value === null || value === false ||
            str === "" || (Array.isArray(value) && value.length === 0);

        const fieldError = field.required && isEmpty
            ? requiredMessage(field.type)
            : !isEmpty ? validateByType(field, str, value) : null;

        setErrors(prev => {
            const next = {...prev};
            if (fieldError) next[fieldId] = fieldError;
            else delete next[fieldId];
            return next;
        });
    };

    const handleChange = (fieldId: string, value: FormAnswers[string]) => {
        setHasInteracted(true);
        setAnswers(prev => {
            const next = {...prev, [fieldId]: value};
            draft.schedule(next);
            return next;
        });
        // Re-validate live once user has touched the field or already tried to submit
        if (touched.has(fieldId) || hasSubmitted) {
            revalidateField(fieldId, value);
        }
    };

    const handleBlur = (fieldId: string) => {
        if (touched.has(fieldId)) return; // already validated
        setTouched(prev => new Set([...prev, fieldId]));
        revalidateField(fieldId, answers[fieldId]);
    };

    const handleSubmit = async () => {
        setHasSubmitted(true);
        const validationErrors = validate(form, answers, visibleIds);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            // Scroll to first error
            const firstErrorId = Object.keys(validationErrors)[0];
            focusField(firstErrorId);
            return;
        }
        if (preview || inFlight.current) return;
        const shownAnswers = Object.fromEntries(Object.entries(answers).filter(([id]) => visibleIds.has(id)));
        inFlight.current = true;
        setSubmitStatus("submitting");
        setSubmitError(null);
        try {
            if (form.slug) setReceipt(await submitPublicForm(form.slug, shownAnswers, idempotencyKey.current,
                form.accessMode === "ANONYMOUS" ? getAnonymousToken() : undefined));
            else await submitForm(form.id, shownAnswers, idempotencyKey.current);
            draft.clear();
            setSubmitStatus("success");
        } catch (err) {
            const serverFieldErrors = fieldErrorsOf(err);
            if (serverFieldErrors) {
                setErrors(serverFieldErrors);
                const firstId = Object.keys(serverFieldErrors)[0];
                focusField(firstId);
            }
            setSubmitError(describeApiError(err, t("form.submissionError")));
            setSubmitStatus("error");
        } finally {
            inFlight.current = false;
        }
    };

    const errorCount = Object.keys(errors).filter(id => visibleIds.has(id)).length;

    if (submitStatus === "success") {
        return (
            <div className="flex min-h-screen flex-col bg-bg font-sans text-tx">
                <FormHeader/>
                <SuccessCard title={form.schema.title} guildName={meta?.guildName} receipt={receipt}/>
            </div>
        );
    }

    /** "Появилось после ответа «Да»" — what made a conditional field appear (ФТ-3.3.6). */
    const conditionNote = (field: FormField) => {
        const c = field.condition;
        const trigger = c ? form.schema.fields.find(f => f.id === c.fieldId) : undefined;
        if (!c || c.operator !== "EQUALS" || c.value == null || !trigger) return t("form.shownByAnswer");
        const answer = trigger.type === "BOOLEAN" || (trigger.type === "CHECKBOX" && !trigger.options?.length)
            ? (c.value === "true" ? t("form.yes") : t("form.no"))
            : c.value;
        return t("form.shownAfter", {answer});
    };

    const renderField = (field: FormField) => {
        const control = (
            <DynamicField field={field} value={answers[field.id]} onChange={handleChange} onBlur={handleBlur}
                          error={(touched.has(field.id) || hasSubmitted) ? errors[field.id] : undefined}/>
        );
        if (!field.condition) return <div key={field.id}>{control}</div>;
        return (
            <motion.div key={field.id} initial={hasInteracted ? {opacity: 0, y: -4} : false} animate={{opacity: 1, y: 0}}
                        transition={{duration: 0.18}}
                        className="flex flex-col gap-2 rounded-xl bg-prs p-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-prt">{conditionNote(field)}</span>
                {control}
            </motion.div>
        );
    };

    return (
        <UploadContext.Provider value={uploadContext}>
            <div className="flex min-h-screen flex-col bg-bg font-sans text-tx">
                <FormHeader progress={progress}/>
                <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 pb-10 sm:pt-8">
                    <FormIntro title={form.schema.title} description={form.schema.description} meta={meta}
                               minutes={minutes} anonymous={form.accessMode === "ANONYMOUS"}/>
                    {requiredFields.length > 0 && (
                        <p className="m-0 px-4 text-[13px] text-mu sm:hidden">
                            {t("form.requiredNote.before")} <span className="font-bold text-rdt">*</span> {t("form.requiredNote.after")}
                        </p>
                    )}
                    {sections.map((section, i) => {
                        const shown = section.fields.filter(f => visibleIds.has(f.id));
                        if (!section.heading && shown.length === 0) return null;
                        return (
                            <section key={section.heading?.id ?? `lead-${i}`}
                                     className="flex flex-col gap-[22px] px-4 py-4 sm:rounded-2xl sm:border sm:border-bd sm:bg-sf sm:px-8 sm:py-[26px]">
                                {section.heading && (
                                    <SectionBreak field={section.heading} label={<>
                                        <span className="sm:hidden">{t("form.sectionOf", {n: section.number, total: sectionCount})}</span>
                                        <span className="hidden sm:inline">{t("form.section", {n: section.number})}</span>
                                    </>}/>
                                )}
                                <AnimatePresence initial={false}>
                                    {layoutRows(shown).map(row => row.kind === "pair"
                                        ? <div key={row.fields.map(f => f.id).join("+")} className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
                                            {row.fields.map(renderField)}
                                        </div>
                                        : renderField(row.field))}
                                </AnimatePresence>
                            </section>
                        );
                    })}
                </main>
                <SubmitBar errorCount={hasSubmitted ? errorCount : 0} draftSavedAt={draft.savedAt}
                           submitting={submitStatus === "submitting"} preview={preview} onSubmit={handleSubmit}
                           submitError={submitStatus === "error" ? submitError : null}/>
                <p className="m-0 px-4 py-3 text-center text-[11px] text-mu/70">{t("form.footer")}</p>
            </div>
        </UploadContext.Provider>
    );
}
