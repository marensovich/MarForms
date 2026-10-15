import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    error?: string;
}

export default function RadioField({field, value, onChange, onBlur, error}: Props) {
    return (
        <FieldWrapper label={field.label} required={field.required} description={field.description} error={error}>
            <div
                className={`flex flex-col gap-2 rounded-xl transition-colors ${error ? "ring-1 ring-rdt/30" : ""}`}>
                {(field.options ?? []).map(opt => (
                    <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                            value === opt
                                ? "border-prs bg-prs"
                                : error
                                    ? "border-rdb bg-rdb hover:border-rdb"
                                    : "border-bd bg-sf hover:border-bd hover:bg-bg"
                        }`}
                    >
                        <input
                            type="radio"
                            name={field.id}
                            value={opt}
                            checked={value === opt}
                            onChange={() => {
                                onChange(opt);
                                onBlur?.();
                            }}
                            className="accent-pr"
                        />
                        <span className="text-sm text-mu">{opt}</span>
                    </label>
                ))}
            </div>
        </FieldWrapper>
    );
}
