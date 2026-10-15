import {type InputHTMLAttributes, type KeyboardEvent, type ReactNode, useRef} from "react";
import {FiCheck} from "react-icons/fi";
import {cx} from "./cx";
import {tabClassName} from "./helpers";

// Docs: docs/design/mockups/Components.dc.html — "Переключатели"; WizStepper.dc.html.

export interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: ReactNode;
    /** Accessible name when there is no visible label. */
    ariaLabel?: string;
    danger?: boolean;
    disabled?: boolean;
    id?: string;
}

export function Switch({checked, onChange, label, ariaLabel, danger, disabled, id}: SwitchProps) {
    const control = (
        <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label ? undefined : ariaLabel}
                disabled={disabled} onClick={() => onChange(!checked)}
                className={cx("flex h-[22px] w-10 flex-none rounded-full p-0.5 transition-colors",
                    "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs disabled:cursor-not-allowed disabled:opacity-50",
                    checked ? (danger ? "justify-end bg-dg" : "justify-end bg-pr") : "justify-start bg-bd")}>
            <span className="h-[18px] w-[18px] rounded-full bg-white shadow-sm"/>
        </button>
    );
    if (!label) return control;
    return <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-tx">{control}{label}</label>;
}

type CheckProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode };

export function Checkbox({label, className, ...rest}: CheckProps) {
    const box = <input type="checkbox" className={cx("h-4 w-4 flex-none accent-pr", className)} {...rest}/>;
    return label ? <label className="inline-flex items-center gap-2 text-sm text-tx">{box}{label}</label> : box;
}

export function Radio({label, className, ...rest}: CheckProps) {
    const dot = <input type="radio" className={cx("h-4 w-4 flex-none accent-pr", className)} {...rest}/>;
    return label ? <label className="inline-flex items-center gap-2 text-sm text-tx">{dot}{label}</label> : dot;
}

/** Arrow-key navigation shared by segmented controls and tabs. */
function rovingKeys<T>(e: KeyboardEvent, values: T[], current: T, select: (v: T) => void, refs: (HTMLButtonElement | null)[]) {
    const index = values.indexOf(current);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % values.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + values.length) % values.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = values.length - 1;
    if (next < 0) return;
    e.preventDefault();
    select(values[next]);
    refs[next]?.focus();
}

export interface SegmentOption<T extends string> {
    value: T;
    label: ReactNode;
    count?: number;
}

export function SegmentedControl<T extends string>({options, value, onChange, ariaLabel}: {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    ariaLabel: string;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    return (
        <div role="radiogroup" aria-label={ariaLabel} className="inline-flex self-start rounded-[10px] border border-bd bg-sf p-[3px]"
             onKeyDown={e => rovingKeys(e, options.map(o => o.value), value, onChange, refs.current)}>
            {options.map((o, i) => {
                const active = o.value === value;
                return (
                    <button key={o.value} ref={el => { refs.current[i] = el; }} type="button" role="radio"
                            aria-checked={active} tabIndex={active ? 0 : -1} onClick={() => onChange(o.value)}
                            className={cx("inline-flex h-[30px] items-center gap-1.5 rounded-lg px-3 text-[13px] transition-colors",
                                "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs",
                                active ? "bg-prs font-semibold text-prt" : "text-mu hover:text-tx")}>
                        {o.label}
                        {o.count !== undefined && <span className="tabular-nums opacity-80">{o.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}

export interface TabItem<T extends string> {
    id: T;
    label: ReactNode;
    /** Pill after the label, e.g. pending submissions (amber in the mockup). */
    count?: number;
    /** A dot that flags a problem inside the tab (ФТ-5.1.3). */
    alert?: boolean;
}

export function TabBadge({count}: { count: number }) {
    return <span className="rounded-full bg-amb px-1.5 text-[11px] font-bold tabular-nums text-amt">{count}</span>;
}

export function Tabs<T extends string>({items, value, onChange, ariaLabel, idPrefix = "tab"}: {
    items: TabItem<T>[];
    value: T;
    onChange: (id: T) => void;
    ariaLabel: string;
    idPrefix?: string;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    return (
        <div role="tablist" aria-label={ariaLabel} className="flex gap-5 border-b border-bd"
             onKeyDown={e => rovingKeys(e, items.map(t => t.id), value, onChange, refs.current)}>
            {items.map((t, i) => {
                const active = t.id === value;
                return (
                    <button key={t.id} ref={el => { refs.current[i] = el; }} type="button" role="tab"
                            id={`${idPrefix}-${t.id}`} aria-selected={active} aria-controls={`${idPrefix}-${t.id}-panel`}
                            tabIndex={active ? 0 : -1} onClick={() => onChange(t.id)}
                            className={cx(tabClassName(active), "-mb-px")}>
                        {t.label}
                        {t.count !== undefined && t.count > 0 && <TabBadge count={t.count}/>}
                        {t.alert && <span className="h-1.5 w-1.5 rounded-full bg-dg" aria-hidden="true"/>}
                    </button>
                );
            })}
        </div>
    );
}

/** Wizard steps: done = filled indigo with a check, current = soft ring, next = grey. */
export function Stepper({steps, current, ariaLabel, onStepClick}: {
    steps: string[];
    /** 1-based. */
    current: number;
    ariaLabel: string;
    /** Lets the user go back to a finished step. */
    onStepClick?: (step: number) => void;
}) {
    return (
        <ol aria-label={ariaLabel} className="m-0 flex list-none items-center gap-2 p-0">
            {steps.map((title, i) => {
                const n = i + 1, done = n < current, on = n === current;
                const content = (
                    <>
                        <span className={cx("grid h-7 w-7 flex-none place-items-center rounded-full text-[13px] font-bold",
                            done && "bg-pr text-white",
                            on && "border-2 border-pr bg-prs text-prt",
                            !done && !on && "border border-bd bg-s2 text-mu")}>
                            {done ? <FiCheck size={14} strokeWidth={3} aria-hidden="true"/> : n}
                        </span>
                        <span className={cx("whitespace-nowrap text-sm",
                            on ? "font-semibold text-tx" : done ? "font-medium text-tx" : "font-medium text-mu")}>{title}</span>
                    </>
                );
                return (
                    <li key={title} aria-current={on ? "step" : undefined} className="flex items-center gap-2">
                        {done && onStepClick ? (
                            <button type="button" onClick={() => onStepClick(n)}
                                    className="flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
                                {content}
                            </button>
                        ) : content}
                        {n < steps.length && (
                            <span aria-hidden="true" className={cx("h-0.5 w-8 rounded-sm", done ? "bg-pr" : "bg-bd")}/>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
