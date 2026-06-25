import {useMemo, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import i18n from "../../i18n";
import type {FieldType, FormAnswers, FormDefinition, FormField} from "../../types/forms";
import {submitForm} from "../../api/forms";
import {ApiError} from "../../api/client";
import {SceneBackground} from "../LoadingScreen";
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
    FiFileText,
    FiHash,
    FiLayers,
    FiLink,
    FiList,
    FiMail,
    FiPhone,
    FiSend,
    FiShield,
    FiToggleLeft,
    FiType,
    FiUser,
} from "react-icons/fi";

// ── Validation ─────────────────────────────────────────────────────────────

function validate(form: FormDefinition, answers: FormAnswers): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const field of form.schema.fields) {
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
    TEXTAREA: 2_147_483_647, // Java Integer.MAX_VALUE — backend TEXT column limit
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
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
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
            className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0f0f21] px-4">
            <SceneBackground variant="success"/>
            <motion.div
                initial={{opacity: 0, scale: 0.93}}
                animate={{opacity: 1, scale: 1}}
                transition={{duration: 0.45, ease: "easeOut"}}
                className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-emerald-500/25 bg-[#0d1a12] shadow-2xl shadow-emerald-900/30"
            >
                <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-transparent"/>
                <div className="flex flex-col items-center px-8 py-10 text-center">
                    <div className="relative mb-5">
                        <div className="absolute inset-0 scale-[2.5] rounded-full bg-emerald-500/15 blur-2xl"/>
                        <motion.div
                            initial={{scale: 0.5, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            transition={{delay: 0.15, type: "spring", stiffness: 200}}
                            className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15"
                        >
                            <FiCheckCircle size={30} className="text-emerald-400"/>
                        </motion.div>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">{t("form.success.title")}</h1>
                    <p className="mt-2.5 text-sm leading-relaxed text-white/60">
                        {t("form.success.description", {formTitle: title})}
                    </p>
                    <div className="mt-6 w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3">
                        <p className="text-xs text-white/50">
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
    const totalFields = form.schema.fields.length;
    const typeGroups = useMemo(() => {
        const counts: Partial<Record<FieldType, number>> = {};
        for (const f of form.schema.fields) {
            counts[f.type] = (counts[f.type] ?? 0) + 1;
        }
        return Object.entries(counts) as [FieldType, number][];
    }, [form.schema.fields]);

    return (
        <aside className="flex flex-col gap-4">
            {/* Branding */}
            <div className="flex items-center gap-2">
                <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/30 border border-indigo-500/30">
                    <FiFileText size={13} className="text-indigo-400"/>
                </div>
                <span className="text-xs font-semibold tracking-wide text-white/40 uppercase">MarForms</span>
            </div>

            {/* Form title + description */}
            <div>
                <h1 className="text-xl font-bold leading-snug text-white">{form.schema.title}</h1>
                {form.schema.description && (
                    <p className="mt-2 text-sm leading-relaxed text-white/50">{form.schema.description}</p>
                )}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/[0.07]"/>

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
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                    <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-white/40">{t("form.sidebar.progress")}</span>
                        <span
                            className={`font-medium tabular-nums ${progress === 100 ? "text-emerald-400" : "text-white/60"}`}>
                            {t("form.sidebar.requiredProgress", {answered: answeredRequired, total: totalRequired})}
                        </span>
                    </div>
                    <ProgressBar pct={progress}/>
                    {progress === 100 && (
                        <p className="mt-2 text-[11px] text-emerald-400">
                            {t("form.sidebar.allFilled")}
                        </p>
                    )}
                </div>
            )}

            {/* Field type breakdown */}
            {typeGroups.length > 0 && (
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">{t("form.sidebar.fieldTypes")}</p>
                    <div className="flex flex-col gap-1.5">
                        {typeGroups.map(([type, count]) => {
                            const Icon = TYPE_ICON[type] ?? FiFileText;
                            const label = type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                            return (
                                <div key={type} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon size={11} className="text-white/30"/>
                                        <span className="text-xs text-white/40">{label}</span>
                                    </div>
                                    <span className="text-xs font-medium text-white/30">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Creator */}
            {(form.createdByDiscordUsername || form.createdByDiscordId) && (
                <div
                    className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
                    <div
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/30 border border-indigo-500/20">
                        <FiUser size={12} className="text-indigo-400"/>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-white/25 leading-none mb-0.5">{t("form.sidebar.createdBy")}</p>
                        <p className="truncate text-xs font-medium text-white/60">
                            {form.createdByDiscordUsername
                                ? `@${form.createdByDiscordUsername}`
                                : form.createdByDiscordId}
                        </p>
                    </div>
                </div>
            )}

            {/* Security badge */}
            <div
                className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] px-3.5 py-3">
                <FiShield size={13} className="flex-shrink-0 text-emerald-400/60"/>
                <p className="text-[11px] text-emerald-400/60 leading-snug">
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
        <div className="flex flex-col gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
            <Icon size={12} className={accent ? "text-red-400/70" : "text-white/25"}/>
            <p className={`text-sm font-semibold ${accent && value !== "0" ? "text-red-400" : "text-white"}`}>
                {value}
            </p>
            <p className="text-[10px] text-white/25 leading-none">{label}</p>
        </div>
    );
}

// ── Main renderer ──────────────────────────────────────────────────────────

interface Props {
    form: FormDefinition;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function FormRenderer({form}: Props) {
    const {t} = useTranslation();
    const [answers, setAnswers] = useState<FormAnswers>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
    const [submitError, setSubmitError] = useState<string | null>(null);

    const requiredFields = useMemo(
        () => form.schema.fields.filter(f => f.required),
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
        setSubmitStatus("submitting");
        setSubmitError(null);
        try {
            await submitForm(form.id, answers);
            setSubmitStatus("success");
        } catch (err) {
            const message = err instanceof ApiError ? err.message : t("form.submissionError");
            setSubmitError(message);
            setSubmitStatus("error");
        }
    };

    if (submitStatus === "success") {
        return <SuccessScreen title={form.schema.title}/>;
    }

    const errorCount = Object.keys(errors).length;

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#0c0c1a]">
            <SceneBackground/>

            {/* Top bar */}
            <header
                className="relative z-20 flex h-12 items-center justify-between border-b border-white/[0.06] bg-[#0c0c1a]/80 px-6 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600/40 border border-indigo-500/30">
                        <FiFileText size={10} className="text-indigo-400"/>
                    </div>
                    <span className="text-xs font-semibold text-white/40">MarForms</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/25">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/60"/>
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
                        className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.03] shadow-2xl backdrop-blur-xl">
                        {/* Top accent line */}
                        <div
                            className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"/>

                        <div className="p-6 sm:p-8">
                            {/* Field count header */}
                            <div className="mb-6 flex items-center justify-between">
                                <p className="text-xs text-white/30">
                                    {t("form.fieldCount", {count: form.schema.fields.length})}
                                    {requiredFields.length > 0 && (
                                        <span className="text-white/20"> {t("form.requiredCount", {count: requiredFields.length})}</span>
                                    )}
                                </p>
                                {progress > 0 && progress < 100 && (
                                    <p className="text-xs text-white/30 tabular-nums">{t("form.percentComplete", {pct: progress})}</p>
                                )}
                                {progress === 100 && (
                                    <p className="text-xs text-emerald-400">{t("form.readyToSubmit")}</p>
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
                                                className="absolute -left-5 top-0.5 hidden h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white/20 sm:flex">
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
                                    className="mt-5 flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-300"
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
                                    className="mt-5 flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-300"
                                >
                                    <FiAlertCircle size={15} className="flex-shrink-0"/>
                                    {submitError}
                                </motion.div>
                            )}

                            {/* Submit button */}
                            <div className="mt-7 border-t border-white/[0.06] pt-6">
                                <motion.button
                                    onClick={handleSubmit}
                                    disabled={submitStatus === "submitting"}
                                    whileHover={{scale: submitStatus === "submitting" ? 1 : 1.015}}
                                    whileTap={{scale: submitStatus === "submitting" ? 1 : 0.985}}
                                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-6 py-3.5 font-semibold text-white shadow-xl shadow-indigo-500/20 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-[#0c0c1a]"
                                >
                                    {submitStatus === "submitting" ? (
                                        <><Spinner/>{t("form.submitting")}</>
                                    ) : (
                                        <><FiSend size={15}/>{t("form.submit")}</>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </div>

                    {/* Footer note */}
                    <p className="mt-4 text-center text-[11px] text-white/20">
                        {t("form.footer")}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
