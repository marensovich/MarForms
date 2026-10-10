import {useMemo, useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import i18n from "../../i18n";
import {type FieldType, type FormAnswers, type FormDefinition, type FormField, isInputField} from "../../types/forms";
import {DEFAULT_RATING_SCALE} from "./fields/RatingField";
import {submitForm, submitPublicForm} from "../../api/forms";
import {getAnonymousToken} from "../../auth/anonymousToken";
import {ApiError} from "../../api/client";
import {describeApiError} from "../../api/errors";

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
import {
    FiAlertCircle,
    FiAlignLeft,
    FiCalendar,
    FiCheckCircle,
    FiCheckSquare,
    FiChevronDown,
    FiCircle,
    FiClock,
    FiEyeOff,
    FiFileText,
    FiHash,
    FiLayers,
    FiLink,
    FiList,
    FiMail,
    FiPhone,
    FiSend,
    FiShield,
    FiStar,
    FiToggleLeft,
    FiType,
    FiUser,
} from "react-icons/fi";

// ── Validation ─────────────────────────────────────────────────────────────

function validate(form: FormDefinition, answers: FormAnswers): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const field of form.schema.fields) {
        if (!isInputField(field)) continue;
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

// ── Field type icons ───────────────────────────────────────────────────────

const TYPE_ICON: Partial<Record<FieldType, React.ElementType>> = {
    TEXT: FiType,
    TEXTAREA: FiAlignLeft,
    NUMBER: FiHash,
    EMAIL: FiMail,
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
};

// ── Helpers ────────────────────────────────────────────────────────────────

function estimateMinutes(count: number): string {
    const t = i18n.t.bind(i18n);
    if (count <= 3) return t("form.estTime.1min");
    if (count <= 7) return t("form.estTime.3min");
    if (count <= 15) return t("form.estTime.5min");
    return t("form.estTime.10min");
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Spinner() {
    // Used only inside the solid-indigo submit button — white is correct here.
    return (
        <motion.div
            className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
            animate={{rotate: 360}}
            transition={{duration: 0.75, repeat: Infinity, ease: "linear"}}
        />
    );
}

function ProgressBar({pct}: { pct: number }) {
    return (
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-[#F0F0F2]">
            <motion.div
                className="absolute left-0 top-0 h-full rounded-full bg-[#3730A3]"
                initial={{width: 0}}
                animate={{width: `${pct}%`}}
                transition={{duration: 0.4, ease: "easeOut"}}
            />
        </div>
    );
}

// ── Success screen ─────────────────────────────────────────────────────────

function SuccessScreen({title}: { title: string }) {
    const {t} = useTranslation();
    return (
        <div
            className="relative flex min-h-screen w-full items-center justify-center bg-[#F7F7F8] px-4">
            <motion.div
                initial={{opacity: 0, scale: 0.93}}
                animate={{opacity: 1, scale: 1}}
                transition={{duration: 0.45, ease: "easeOut"}}
                className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[#D7E8D9] bg-white"
            >
                <div className="h-1 w-full bg-[#5C8F6A]"/>
                <div className="flex flex-col items-center px-8 py-10 text-center">
                    <motion.div
                        initial={{scale: 0.5, opacity: 0}}
                        animate={{scale: 1, opacity: 1}}
                        transition={{delay: 0.15, type: "spring", stiffness: 200}}
                        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D7E8D9] bg-[#EEF4EE]"
                    >
                        <FiCheckCircle size={30} className="text-[#3F6B4A]"/>
                    </motion.div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#1E1E24]">{t("form.success.title")}</h1>
                    <p className="mt-2.5 text-sm leading-relaxed text-[#6B6B76]">
                        {t("form.success.description", {formTitle: title})}
                    </p>
                    <div className="mt-6 flex w-full items-center justify-between rounded-xl border border-[#EFDFC0] bg-[#FBF3E4] px-4 py-3">
                        <span className="text-xs text-[#92702A]">{t("form.success.statusLabel")}</span>
                        <span className="text-xs font-semibold text-[#92702A]">{t("form.success.statusPending")}</span>
                    </div>
                    <div className="mt-3 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] px-4 py-3">
                        <p className="text-xs text-[#8B8B96]">
                            {t("form.success.closeNote")}
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

interface SidebarProps {
    form: FormDefinition;
    progress: number;
    answeredRequired: number;
    totalRequired: number;
}

function FormSidebar({form, progress, answeredRequired, totalRequired}: SidebarProps) {
    const {t} = useTranslation();
    const totalFields = form.schema.fields.filter(isInputField).length;
    const typeGroups = useMemo(() => {
        const counts: Partial<Record<FieldType, number>> = {};
        for (const f of form.schema.fields.filter(isInputField)) {
            counts[f.type] = (counts[f.type] ?? 0) + 1;
        }
        return Object.entries(counts) as [FieldType, number][];
    }, [form.schema.fields]);

    return (
        <aside className="flex flex-col gap-4">
            {/* Branding */}
            <div className="flex items-center gap-2">
                <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF0FB] border border-[#D8DCF5]">
                    <FiFileText size={13} className="text-[#3730A3]"/>
                </div>
                <span className="text-xs font-semibold tracking-wide text-[#8B8B96] uppercase">MarForms</span>
            </div>

            {/* Form title + description */}
            <div>
                <h1 className="text-xl font-bold leading-snug text-[#1E1E24]">{form.schema.title}</h1>
                {form.schema.description && (
                    <p className="mt-2 text-sm leading-relaxed text-[#6B6B76]">{form.schema.description}</p>
                )}
                {form.accessMode === "ANONYMOUS" && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FAFAFB] px-3 py-2 text-xs text-[#55555F]">
                        <FiEyeOff size={12} className="mt-0.5 flex-shrink-0"/>
                        {t("form.anonymousNote")}
                    </p>
                )}
            </div>

            {/* Divider */}
            <div className="h-px bg-[#E4E4E7]"/>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
                <StatCard icon={FiList} label={t("form.sidebar.fields")} value={String(totalFields)}/>
                <StatCard
                    icon={FiAlertCircle}
                    label={t("form.sidebar.required")}
                    value={String(totalRequired)}
                    accent={totalRequired > 0}
                />
                <StatCard icon={FiClock} label={t("form.sidebar.estTime")} value={estimateMinutes(totalFields)}/>
            </div>

            {/* Progress (only when filling) */}
            {totalRequired > 0 && (
                <div className="rounded-xl border border-[#E4E4E7] bg-white p-3.5">
                    <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-[#8B8B96]">{t("form.sidebar.progress")}</span>
                        <span
                            className={`font-medium tabular-nums ${progress === 100 ? "text-[#3F6B4A]" : "text-[#6B6B76]"}`}>
                            {t("form.sidebar.requiredProgress", {answered: answeredRequired, total: totalRequired})}
                        </span>
                    </div>
                    <ProgressBar pct={progress}/>
                    {progress === 100 && (
                        <p className="mt-2 text-[11px] text-[#3F6B4A]">
                            {t("form.sidebar.allFilled")}
                        </p>
                    )}
                </div>
            )}

            {/* Field type breakdown */}
            {typeGroups.length > 0 && (
                <div className="rounded-xl border border-[#E4E4E7] bg-white p-3.5">
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">{t("form.sidebar.fieldTypes")}</p>
                    <div className="flex flex-col gap-1.5">
                        {typeGroups.map(([type, count]) => {
                            const Icon = TYPE_ICON[type] ?? FiFileText;
                            const label = type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                            return (
                                <div key={type} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon size={11} className="text-[#B5B5BC]"/>
                                        <span className="text-xs text-[#8B8B96]">{label}</span>
                                    </div>
                                    <span className="text-xs font-medium text-[#B5B5BC]">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Creator */}
            {(form.createdByDiscordUsername || form.createdByDiscordId) && (
                <div
                    className="flex items-center gap-2.5 rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-3">
                    <div
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#EEF0FB] border border-[#D8DCF5]">
                        <FiUser size={12} className="text-[#3730A3]"/>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-[#C7C7CE] leading-none mb-0.5">{t("form.sidebar.createdBy")}</p>
                        <p className="truncate text-xs font-medium text-[#6B6B76]">
                            {form.createdByDiscordUsername
                                ? `@${form.createdByDiscordUsername}`
                                : form.createdByDiscordId}
                        </p>
                    </div>
                </div>
            )}

            {/* Security badge */}
            <div
                className="flex items-center gap-2 rounded-xl border border-[#D7E8D9] bg-[#EEF4EE] px-3.5 py-3">
                <FiShield size={13} className="flex-shrink-0 text-[#5C8F6A]"/>
                <p className="text-[11px] text-[#3F6B4A] leading-snug">
                    {t("form.sidebar.secure")}
                </p>
            </div>
        </aside>
    );
}

function StatCard({icon: Icon, label, value, accent = false}: {
    icon: React.ElementType;
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1 rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5">
            <Icon size={12} className={accent ? "text-[#B56A65]" : "text-[#C7C7CE]"}/>
            <p className={`text-sm font-semibold ${accent && value !== "0" ? "text-[#B56A65]" : "text-[#1E1E24]"}`}>
                {value}
            </p>
            <p className="text-[10px] text-[#C7C7CE] leading-none">{label}</p>
        </div>
    );
}

// ── Main renderer ──────────────────────────────────────────────────────────

interface Props {
    form: FormDefinition;
    /**
     * Builder preview (#45): renders exactly what a respondent sees and runs
     * the same validation, but never submits.
     */
    preview?: boolean;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function FormRenderer({form, preview = false}: Props) {
    const {t} = useTranslation();
    const [answers, setAnswers] = useState<FormAnswers>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
    const [submitError, setSubmitError] = useState<string | null>(null);
    // One key per filled-in form, reused on every retry: if a response is
    // lost (network drop) and the user presses Submit again, the server
    // returns the original submission instead of storing a duplicate (#51).
    const idempotencyKey = useRef<string>(crypto.randomUUID());
    // Guards against a double click landing before the "submitting" state renders.
    const inFlight = useRef(false);

    const requiredFields = useMemo(
        () => form.schema.fields.filter(f => f.required && isInputField(f)),
        [form.schema.fields]
    );

    const answeredRequired = useMemo(() => {
        return requiredFields.filter(f => {
            const v = answers[f.id];
            if (v === undefined || v === "" || v === false) return false;
            if (Array.isArray(v) && v.length === 0) return false;
            return true;
        }).length;
    }, [answers, requiredFields]);

    const progress = requiredFields.length === 0
        ? 100
        : Math.round((answeredRequired / requiredFields.length) * 100);

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
        setAnswers(prev => ({...prev, [fieldId]: value}));
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
        const validationErrors = validate(form, answers);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            // Scroll to first error
            const firstErrorId = Object.keys(validationErrors)[0];
            document.getElementById(`field-${firstErrorId}`)?.scrollIntoView({behavior: "smooth", block: "center"});
            return;
        }
        if (preview || inFlight.current) return;
        inFlight.current = true;
        setSubmitStatus("submitting");
        setSubmitError(null);
        try {
            if (form.slug) await submitPublicForm(form.slug, answers, idempotencyKey.current,
                form.accessMode === "ANONYMOUS" ? getAnonymousToken() : undefined);
            else await submitForm(form.id, answers, idempotencyKey.current);
            setSubmitStatus("success");
        } catch (err) {
            const serverFieldErrors = fieldErrorsOf(err);
            if (serverFieldErrors) {
                setErrors(serverFieldErrors);
                const firstId = Object.keys(serverFieldErrors)[0];
                document.getElementById(`field-${firstId}`)?.scrollIntoView({behavior: "smooth", block: "center"});
            }
            setSubmitError(describeApiError(err, t("form.submissionError")));
            setSubmitStatus("error");
        } finally {
            inFlight.current = false;
        }
    };

    if (submitStatus === "success") {
        return <SuccessScreen title={form.schema.title}/>;
    }

    const errorCount = Object.keys(errors).length;

    return (
        <div className="relative min-h-screen w-full bg-[#F7F7F8]">
            {/* Top bar */}
            <header
                className="relative z-20 flex h-12 items-center justify-between border-b border-[#E4E4E7] bg-white/90 px-6 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-[#EEF0FB] border border-[#D8DCF5]">
                        <FiFileText size={10} className="text-[#3730A3]"/>
                    </div>
                    <span className="text-xs font-semibold text-[#6B6B76]">MarForms</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#8B8B96]">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#5C8F6A]"/>
                    {t("form.topBar.secure")}
                </div>
            </header>

            {/* Page content */}
            <motion.div
                initial={{opacity: 0, y: 16}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.4, ease: "easeOut"}}
                className="relative z-10 mx-auto max-w-5xl px-4 py-10 lg:grid lg:grid-cols-[300px_1fr] lg:gap-10"
            >
                {/* ── Left: Sidebar ─────────────────────────────────── */}
                <div className="mb-8 lg:mb-0 lg:sticky lg:top-10 lg:h-fit">
                    <FormSidebar
                        form={form}
                        progress={progress}
                        answeredRequired={answeredRequired}
                        totalRequired={requiredFields.length}
                    />
                </div>

                {/* ── Right: Form card ───────────────────────────────── */}
                <div>
                    <div
                        className="overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white">
                        {/* Top accent line */}
                        <div className="h-1 w-full bg-[#3730A3]"/>

                        <div className="p-6 sm:p-8">
                            {/* Field count header */}
                            <div className="mb-6 flex items-center justify-between">
                                <p className="text-xs text-[#8B8B96]">
                                    {t("form.fieldCount", {count: form.schema.fields.filter(isInputField).length})}
                                    {requiredFields.length > 0 && (
                                        <span className="text-[#C7C7CE]"> {t("form.requiredCount", {count: requiredFields.length})}</span>
                                    )}
                                </p>
                                {progress > 0 && progress < 100 && (
                                    <p className="text-xs text-[#8B8B96] tabular-nums">{t("form.percentComplete", {pct: progress})}</p>
                                )}
                                {progress === 100 && (
                                    <p className="text-xs text-[#3F6B4A]">{t("form.readyToSubmit")}</p>
                                )}
                            </div>

                            {/* Fields */}
                            <div className="flex flex-col gap-6">
                                <AnimatePresence>
                                    {form.schema.fields.map((field, idx) => (
                                        <motion.div
                                            key={field.id}
                                            id={`field-${field.id}`}
                                            initial={{opacity: 0, y: 8}}
                                            animate={{opacity: 1, y: 0}}
                                            transition={{delay: idx * 0.04, duration: 0.28}}
                                            className="relative"
                                        >
                                            {/* Field ordinal */}
                                            <div
                                                className="absolute -left-5 top-0.5 hidden h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-[#C7C7CE] sm:flex">
                                                {idx + 1}
                                            </div>
                                            <DynamicField
                                                field={field}
                                                value={answers[field.id]}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                error={errors[field.id]}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>

                            {/* Validation summary */}
                            {hasSubmitted && errorCount > 0 && (
                                <motion.div
                                    initial={{opacity: 0, y: -6}}
                                    animate={{opacity: 1, y: 0}}
                                    className="mt-5 flex items-center gap-3 rounded-xl border border-[#EFDFC0] bg-[#FBF3E4] px-4 py-3 text-sm text-[#92702A]"
                                >
                                    <FiAlertCircle size={15} className="flex-shrink-0"/>
                                    {t("form.validationSummary", {count: errorCount})}
                                </motion.div>
                            )}

                            {/* Submit error */}
                            {submitStatus === "error" && submitError && (
                                <motion.div
                                    initial={{opacity: 0, y: -6}}
                                    animate={{opacity: 1, y: 0}}
                                    className="mt-5 flex items-center gap-3 rounded-xl border border-[#EAD4D3] bg-[#F7EEEE] px-4 py-3 text-sm text-[#8B4A46]"
                                >
                                    <FiAlertCircle size={15} className="flex-shrink-0"/>
                                    {submitError}
                                </motion.div>
                            )}

                            {/* Submit button */}
                            <div className="mt-7 border-t border-[#E4E4E7] pt-6">
                                <motion.button
                                    onClick={handleSubmit}
                                    disabled={submitStatus === "submitting" || preview}
                                    whileHover={{scale: submitStatus === "submitting" ? 1 : 1.015}}
                                    whileTap={{scale: submitStatus === "submitting" ? 1 : 0.985}}
                                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#3730A3] px-6 py-3.5 font-semibold text-white transition-colors hover:bg-[#2D2682] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#3730A3]/40 focus:ring-offset-2 focus:ring-offset-white"
                                >
                                    {submitStatus === "submitting" ? (
                                        <><Spinner/>{t("form.submitting")}</>
                                    ) : (
                                        <><FiSend size={15}/>{preview ? t("form.previewSubmitDisabled") : t("form.submit")}</>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </div>

                    {/* Footer note */}
                    <p className="mt-4 text-center text-[11px] text-[#C7C7CE]">
                        {t("form.footer")}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
