import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";
import {cx} from "../../../ui";
import {useRef} from "react";

export const DEFAULT_RATING_SCALE = 5;

interface Props {
    field: FormField;
    value: number | undefined;
    onChange: (value: number) => void;
    onBlur?: () => void;
    error?: string;
}

/** 1–5 as numbered 44 px buttons; the chosen one is filled, those below it tinted (FormDesktop.dc.html). */
export default function RatingField({field, value, onChange, onBlur, error}: Props) {
    const scale = field.max ?? DEFAULT_RATING_SCALE;
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const pick = (n: number) => {
        onChange(n);
        onBlur?.();
    };
    const onKey = (e: React.KeyboardEvent) => {
        const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (!delta) return;
        e.preventDefault();
        const next = Math.min(scale, Math.max(1, (value ?? 0) + delta));
        pick(next);
        refs.current[next - 1]?.focus();
    };
    return (
        <FieldWrapper fieldId={field.id} label={field.label} required={field.required} description={field.description} error={error} group>
            <div role="radiogroup" aria-label={field.label} className="flex flex-wrap gap-1.5" onKeyDown={onKey}>
                {Array.from({length: scale}, (_, i) => i + 1).map(n => {
                    const chosen = value === n;
                    const below = value !== undefined && n < value;
                    return (
                        <button key={n} ref={el => { refs.current[n - 1] = el; }} type="button" role="radio" aria-checked={chosen}
                                aria-label={`${n} / ${scale}`} tabIndex={chosen || (value === undefined && n === 1) ? 0 : -1}
                                onClick={() => pick(n)}
                                className={cx("grid h-11 w-11 place-items-center rounded-[10px] text-[15px] font-bold transition-colors",
                                    "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs",
                                    chosen ? "border-[1.5px] border-pr bg-pr text-white"
                                        : below ? "border-[1.5px] border-pr bg-prs text-prt"
                                            : cx("border bg-sf text-mu hover:text-tx", error ? "border-dg" : "border-bd"))}>
                            {n}
                        </button>
                    );
                })}
            </div>
        </FieldWrapper>
    );
}
