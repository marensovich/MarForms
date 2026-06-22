import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";

interface Props {
    field: FormField;
    value: boolean;
    onChange: (value: boolean) => void;
    error?: string;
}

export default function CheckboxField({
                                          field,
                                          value,
                                          onChange,
                                          error,
                                      }: Props) {
    return (
        <FieldWrapper label={field.label} required={field.required} error={error}>
            <label
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition-colors hover:border-white/20">
                <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 accent-indigo-500"
                />
                <span className="text-sm text-white/60">{field.label}</span>
            </label>
        </FieldWrapper>
    );
}