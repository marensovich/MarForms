import type {FormField} from "../../../types/forms";

/** A heading that splits a long form into sections — not an input. */
export default function SectionBreak({field}: { field: FormField }) {
    return (
        <div className="border-t border-[#E4E4E7] pt-5">
            <h2 className="text-base font-semibold text-[#1E1E24]">{field.label}</h2>
            {field.description && (
                <p className="mt-1 text-sm leading-relaxed text-[#6B6B76]">{field.description}</p>
            )}
        </div>
    );
}
