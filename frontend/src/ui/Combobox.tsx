import {type KeyboardEvent, type ReactNode, useId, useMemo, useRef, useState} from "react";
import {cx} from "./cx";

// Docs: docs/design/mockups/Components.dc.html — "Combobox · добавить роль".

export interface ComboOption {
    value: string;
    label: string;
    /** CSS colour of a leading dot (Discord role colour). */
    dot?: string;
    /** Right-aligned note, e.g. "48 чел.". */
    meta?: ReactNode;
    disabled?: boolean;
    /** Why it is disabled, e.g. "уже в запрещённых". */
    disabledReason?: string;
}

/** Bolds the part of the label that matches the query. */
function highlight(label: string, query: string): ReactNode {
    const i = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (i < 0) return label;
    return <>{label.slice(0, i)}<b>{label.slice(i, i + query.length)}</b>{label.slice(i + query.length)}</>;
}

export function Combobox({options, onSelect, ariaLabel, placeholder, emptyText, autoFocus, className}: {
    options: ComboOption[];
    onSelect: (value: string) => void;
    ariaLabel: string;
    placeholder?: string;
    emptyText: string;
    autoFocus?: boolean;
    className?: string;
}) {
    const listId = useId();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
    }, [options, query]);

    const move = (from: number, step: 1 | -1) => {
        for (let i = 1; i <= filtered.length; i++) {
            const next = (from + step * i + filtered.length) % filtered.length;
            if (!filtered[next].disabled) return next;
        }
        return from;
    };

    const choose = (option: ComboOption | undefined) => {
        if (!option || option.disabled) return;
        onSelect(option.value);
        setQuery("");
        setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
                setOpen(true);
                setActive(move(-1, 1));
                return;
            }
            if (filtered.length) setActive(a => move(a, e.key === "ArrowDown" ? 1 : -1));
        } else if (e.key === "Enter") {
            if (open) {
                e.preventDefault();
                choose(filtered[active]);
            }
        } else if (e.key === "Escape") {
            if (open) {
                e.stopPropagation();
                setOpen(false);
            }
        }
    };

    const activeOption = open ? filtered[active] : undefined;
    return (
        <div className={cx("relative", className)}>
            <input ref={inputRef} role="combobox" aria-label={ariaLabel} aria-expanded={open} aria-controls={listId}
                   aria-autocomplete="list" aria-activedescendant={activeOption ? `${listId}-${activeOption.value}` : undefined}
                   value={query} placeholder={placeholder} autoFocus={autoFocus} autoComplete="off"
                   onChange={e => {
                       setQuery(e.target.value);
                       setOpen(true);
                       setActive(0);
                   }}
                   onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
                   className="h-10 w-full rounded-[10px] border border-bd bg-sf px-3 text-sm text-tx placeholder:text-mu/70 focus:border-pr focus:outline focus:outline-[3px] focus:outline-prs"/>
            {open && (
                <div id={listId} role="listbox" aria-label={ariaLabel}
                     className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 flex max-h-72 flex-col gap-0.5 overflow-auto rounded-xl border border-bd bg-sf p-1.5 text-sm shadow-popover">
                    {filtered.length === 0 && <div className="px-2.5 py-2 text-mu">{emptyText}</div>}
                    {filtered.map((o, i) => (
                        <div key={o.value} id={`${listId}-${o.value}`} role="option" aria-selected={i === active}
                             aria-disabled={o.disabled || undefined}
                             onMouseDown={e => e.preventDefault()} onMouseEnter={() => !o.disabled && setActive(i)}
                             onClick={() => choose(o)}
                             className={cx("flex items-center gap-2 rounded-lg px-2.5 py-2",
                                 o.disabled ? "cursor-not-allowed text-mu" : "cursor-pointer text-tx",
                                 i === active && !o.disabled && "bg-prs")}>
                            {o.dot && <span className="h-2 w-2 flex-none rounded-full" style={{background: o.dot}} aria-hidden="true"/>}
                            <span className="truncate">{highlight(o.label, query.trim())}{o.disabled && o.disabledReason && ` · ${o.disabledReason}`}</span>
                            {o.meta && <span className="ml-auto flex-none text-xs text-mu">{o.meta}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
