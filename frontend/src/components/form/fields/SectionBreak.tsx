import type {ReactNode} from "react";
import type {FormField} from "../../../types/forms";

/**
 * The heading of a form section (FormDesktop.dc.html): "Раздел 2" in small
 * indigo capitals, then its title and description. Used inside the section card.
 */
export default function SectionBreak({field, label}: { field: FormField; label: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-prt">{label}</span>
            <h2 className="m-0 text-xl font-bold text-tx sm:text-[19px]">{field.label}</h2>
            {field.description && <p className="m-0 text-sm leading-relaxed text-mu">{field.description}</p>}
        </div>
    );
}
