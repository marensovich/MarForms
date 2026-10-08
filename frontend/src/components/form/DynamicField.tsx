import type {FormAnswers, FormField} from "../../types/forms";
import TextField from "./fields/TextField";
import SelectField from "./fields/SelectField";
import MultiSelectField from "./fields/MultiSelectField";
import RadioField from "./fields/RadioField";
import CheckboxField from "./fields/CheckboxField";
import RatingField from "./fields/RatingField";
import SectionBreak from "./fields/SectionBreak";

interface Props {
    field: FormField;
    value: FormAnswers[string];
    onChange: (fieldId: string, value: FormAnswers[string]) => void;
    onBlur: (fieldId: string) => void;
    error?: string;
}

const TEXT_TYPES = new Set([
    "TEXT", "TEXTAREA", "NUMBER", "EMAIL",
    "PASSWORD", "URL", "PHONE", "DATE", "TIME", "DATETIME",
] satisfies FormField["type"][]);

export default function DynamicField({field, value, onChange, onBlur, error}: Props) {
    const onChangeStr = (v: string) => onChange(field.id, v);
    const onChangeBool = (v: boolean) => onChange(field.id, v);
    const onChangeArr = (v: string[]) => onChange(field.id, v);
    const handleBlur = () => onBlur(field.id);

    if (TEXT_TYPES.has(field.type as never)) {
        return (
            <TextField
                field={field}
                value={(value as string) ?? ""}
                onChange={onChangeStr}
                onBlur={handleBlur}
                error={error}
            />
        );
    }

    switch (field.type) {
        case "SELECT":
            return (
                <SelectField
                    field={field}
                    value={(value as string) ?? ""}
                    onChange={onChangeStr}
                    onBlur={handleBlur}
                    error={error}
                />
            );
        case "MULTI_SELECT":
            return (
                <MultiSelectField
                    field={field}
                    value={(value as string[]) ?? []}
                    onChange={onChangeArr}
                    onBlur={handleBlur}
                    error={error}
                />
            );
        case "RADIO":
            return (
                <RadioField
                    field={field}
                    value={(value as string) ?? ""}
                    onChange={onChangeStr}
                    onBlur={handleBlur}
                    error={error}
                />
            );
        case "RATING":
            return (
                <RatingField
                    field={field}
                    value={typeof value === "number" ? value : undefined}
                    onChange={v => onChange(field.id, v)}
                    onBlur={handleBlur}
                    error={error}
                />
            );
        case "SECTION_BREAK":
            return <SectionBreak field={field}/>;
        case "CHECKBOX":
        case "BOOLEAN":
            return (
                <CheckboxField
                    field={field}
                    value={(value as boolean) ?? false}
                    onChange={onChangeBool}
                    onBlur={handleBlur}
                    error={error}
                />
            );
        default:
            return null;
    }
}
