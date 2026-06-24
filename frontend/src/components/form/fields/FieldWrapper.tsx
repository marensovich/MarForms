import type {ReactNode} from "react";
import {FiAlertCircle} from "react-icons/fi";

interface FieldWrapperProps {
    label: string;
    required: boolean;
    error?: string;
    description?: string;
    counter?: ReactNode;
    children: ReactNode;
}

export default function FieldWrapper({label, required, error, description, counter, children}: FieldWrapperProps) {
    return (
        <div className="flex flex-col gap-1.5">
            {/* Label row */}
            <div className="flex items-baseline justify-between gap-2">
                <label className="text-sm font-semibold text-white/80">
                    {label}
                    {required && (
                        <span className="ml-1.5 text-red-400/80" title="Required">*</span>
                    )}
                </label>
                {!required && (
                    <span className="text-xs text-white/20">Optional</span>
                )}
            </div>

            {/* Helper text */}
            {description && (
                <p className="text-xs leading-relaxed text-white/35">{description}</p>
            )}

            {/* Input slot */}
            {children}

            {/* Bottom row: error (left) + counter/hint (right) */}
            {(error || counter) && (
                <div className="flex items-start justify-between gap-2 min-h-[16px]">
                    <div className="flex-1">
                        {error && (
                            <p className="flex items-center gap-1.5 text-xs text-red-400">
                                <FiAlertCircle size={11} className="flex-shrink-0"/>
                                {error}
                            </p>
                        )}
                    </div>
                    {counter && (
                        <div className="flex-shrink-0">{counter}</div>
                    )}
                </div>
            )}
        </div>
    );
}
