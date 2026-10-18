import type {ReactNode} from "react";
import {FiChevronDown} from "react-icons/fi";

/** A filter that looks like the mockup's «Статус: <b>На рассмотрении</b> ▾» button, over a native select. */
export default function FilterSelect({label, value, onChange, children, strong = true}: {
    label: string;
    /** The value in bold, as in the queue's filters (the journal's are plain). */
    strong?: boolean;
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
}) {
    return (
        <label className="relative flex h-10 items-center gap-2 rounded-xl border border-bd bg-sf pl-3 pr-2 text-sm text-tx focus-within:border-pr">
            <span>{label}:</span>
            <select value={value} onChange={e => onChange(e.target.value)}
                    className={`cursor-pointer appearance-none bg-transparent pr-6 text-tx outline-none ${strong ? "font-bold" : ""}`}>
                {children}
            </select>
            <FiChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-2 text-mu"/>
        </label>
    );
}
