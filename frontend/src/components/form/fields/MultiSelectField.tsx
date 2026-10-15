import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: string[];
    onChange: (value: string[]) => void;
    onBlur?: () => void;
    error?: string;
}

export default function MultiSelectField({field, value, onChange, onBlur, error}: Props) {
    const toggle = (opt: string) => {
        const next = value.includes(opt)
            ? value.filter(v => v !== opt)
            : [...value, opt];
        onChange(next);
        onBlur?.();
    };

    return (
        <FieldWrapper label={field.label} required={field.required} description={field.description} error={error}>
            <div
                className={`flex flex-wrap gap-2 rounded-xl p-0.5 transition-colors ${error ? "ring-1 ring-rdt/30" : ""}`}>
                {(field.options ?? []).map(opt => {
                    const selected = value.includes(opt);
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => toggle(opt)}
                            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                                selected
                                    ? "border-pr bg-prs text-prt"
                                    : error
                                        ? "border-rdb bg-rdb text-rdt hover:border-rdb"
                                        : "border-bd bg-sf text-mu hover:border-bd hover:text-tx"
                            }`}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
        </FieldWrapper>
    );
}
