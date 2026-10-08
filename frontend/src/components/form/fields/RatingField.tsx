import {FiStar} from "react-icons/fi";
import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

export const DEFAULT_RATING_SCALE = 5;

interface Props {
    field: FormField;
    value: number | undefined;
    onChange: (value: number) => void;
    onBlur?: () => void;
    error?: string;
}

export default function RatingField({field, value, onChange, onBlur, error}: Props) {
    const scale = field.max ?? DEFAULT_RATING_SCALE;
    return (
        <FieldWrapper label={field.label} required={field.required} description={field.description} error={error}>
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={field.label}>
                {Array.from({length: scale}, (_, i) => i + 1).map(n => {
                    const active = value !== undefined && n <= value;
                    return (
                        <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={value === n}
                            aria-label={`${n} / ${scale}`}
                            onClick={() => {
                                onChange(n);
                                onBlur?.();
                            }}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                                active
                                    ? "border-[#EFDFC0] bg-[#FBF3E4] text-[#C99A3E]"
                                    : error
                                        ? "border-[#EAD4D3] bg-[#F7EEEE] text-[#C7C7CE]"
                                        : "border-[#E4E4E7] bg-white text-[#C7C7CE] hover:border-[#D4D4D9]"
                            }`}
                        >
                            <FiStar size={15} fill={active ? "currentColor" : "none"}/>
                        </button>
                    );
                })}
                {value !== undefined && (
                    <span className="ml-2 text-xs tabular-nums text-[#8B8B96]">{value} / {scale}</span>
                )}
            </div>
        </FieldWrapper>
    );
}
