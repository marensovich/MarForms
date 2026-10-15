import type {FormField} from "../../../types/forms";

/** A heading that splits a long form into sections — not an input. */
export default function SectionBreak({field}: { field: FormField }) {
    return (
        <div className="border-t border-bd pt-5">
            <h2 className="text-base font-semibold text-tx">{field.label}</h2>
            {field.description && (
                <p className="mt-1 text-sm leading-relaxed text-mu">{field.description}</p>
            )}
        </div>
    );
}
