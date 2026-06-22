import {useState} from "react";
import {motion} from "framer-motion";
import type {FormAnswers, FormDefinition} from "../../types/forms";
import {submitForm} from "../../api/forms";
import {ApiError} from "../../api/client";
import {BackgroundGlow} from "../LoadingScreen";
import DynamicField from "./DynamicField";

interface Props {
    form: FormDefinition;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

function validate(form: FormDefinition, answers: FormAnswers): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const field of form.schema.fields) {
        if (!field.required) continue;

        const val = answers[field.id];

        if (val === undefined || val === "" || val === false) {
            errors[field.id] = "This field is required";
            continue;
        }
        if (Array.isArray(val) && val.length === 0) {
            errors[field.id] = "Please select at least one option";
        }
    }

    return errors;
}

export default function FormRenderer({form}: Props) {
    const [answers, setAnswers] = useState<FormAnswers>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
    const [submitError, setSubmitError] = useState<string | null>(null);

    const handleChange = (fieldId: string, value: FormAnswers[string]) => {
        setAnswers((prev) => ({...prev, [fieldId]: value}));
        // сбрасываем ошибку поля при изменении
        if (errors[fieldId]) {
            setErrors((prev) => {
                const next = {...prev};
                delete next[fieldId];
                return next;
            });
        }
    };

    const handleSubmit = async () => {
        const validationErrors = validate(form, answers);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setSubmitStatus("submitting");
        setSubmitError(null);

        try {
            await submitForm(form.id, answers);
            setSubmitStatus("success");
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : "Something went wrong. Please try again.";
            setSubmitError(message);
            setSubmitStatus("error");
        }
    };

    if (submitStatus === "success") {
        return <SuccessScreen title={form.schema.title}/>;
    }

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0f] px-4 py-12">
            <BackgroundGlow/>

            <motion.div
                initial={{opacity: 0, y: 16}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.45, ease: "easeOut"}}
                className="relative z-10 mx-auto w-full max-w-xl"
            >
                {/* Заголовок формы */}
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-white">
                        {form.schema.title}
                    </h1>
                    {form.schema.description && (
                        <p className="mt-2 text-sm text-white/50">
                            {form.schema.description}
                        </p>
                    )}
                </div>

                {/* Карточка с полями */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                    <div className="flex flex-col gap-5">
                        {form.schema.fields.map((field, idx) => (
                            <motion.div
                                key={field.id}
                                initial={{opacity: 0, y: 8}}
                                animate={{opacity: 1, y: 0}}
                                transition={{delay: idx * 0.05, duration: 0.3}}
                            >
                                <DynamicField
                                    field={field}
                                    value={answers[field.id]}
                                    onChange={handleChange}
                                    error={errors[field.id]}
                                />
                            </motion.div>
                        ))}
                    </div>

                    {submitError && (
                        <p className="mt-4 text-sm text-red-400">{submitError}</p>
                    )}

                    <motion.button
                        onClick={handleSubmit}
                        disabled={submitStatus === "submitting"}
                        whileHover={{scale: submitStatus === "submitting" ? 1 : 1.02}}
                        whileTap={{scale: submitStatus === "submitting" ? 1 : 0.98}}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 font-medium text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0f]"
                    >
                        {submitStatus === "submitting" ? (
                            <>
                                <Spinner/>
                                Submitting...
                            </>
                        ) : (
                            "Submit"
                        )}
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
}

function SuccessScreen({title}: { title: string }) {
    return (
        <div
            className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a0f] px-4">
            <BackgroundGlow/>
            <motion.div
                initial={{opacity: 0, scale: 0.95}}
                animate={{opacity: 1, scale: 1}}
                transition={{duration: 0.4, ease: "easeOut"}}
                className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-10 text-center shadow-2xl backdrop-blur-xl"
            >
                <div className="mb-4 text-5xl">✅</div>
                <h1 className="text-2xl font-semibold text-white">
                    Response submitted!
                </h1>
                <p className="mt-2 text-sm text-white/50">
                    Your response to &ldquo;{title}&rdquo; has been recorded.
                </p>
            </motion.div>
        </div>
    );
}

function Spinner() {
    return (
        <motion.div
            className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
            animate={{rotate: 360}}
            transition={{duration: 0.8, repeat: Infinity, ease: "linear"}}
        />
    );
}