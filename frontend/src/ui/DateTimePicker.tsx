import {type KeyboardEvent, useEffect, useId, useMemo, useRef, useState} from "react";
import {FiCalendar, FiChevronLeft, FiChevronRight, FiX} from "react-icons/fi";
import {useTranslation} from "react-i18next";
import {cx} from "./cx";
import {monthGrid, parseLocal, timeSlots, toDateKey} from "./helpers";

// Docs: docs/design/mockups/Components.dc.html — "Дата и время".
// Value: local "YYYY-MM-DDTHH:mm" (what the backend's LocalDateTime takes), or null.

export function DateTimePicker({value, onChange, ariaLabel, placeholder, step = 30, id, disabled}: {
    value: string | null;
    onChange: (value: string | null) => void;
    ariaLabel?: string;
    placeholder?: string;
    step?: number;
    id?: string;
    disabled?: boolean;
}) {
    const {t, i18n} = useTranslation();
    const dialogId = useId();
    const parsed = parseLocal(value);
    const [open, setOpen] = useState(false);
    const [view, setView] = useState(() => parsed ? new Date(`${parsed.date}T00:00`) : new Date());
    const [focusDay, setFocusDay] = useState<string>(parsed?.date ?? toDateKey(new Date()));
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const today = toDateKey(new Date());

    const locale = i18n.language || "ru";
    const monthTitle = new Intl.DateTimeFormat(locale, {month: "long", year: "numeric"}).format(view);
    const weekdays = useMemo(() => Array.from({length: 7}, (_, i) =>
        new Intl.DateTimeFormat(locale, {weekday: "short"}).format(new Date(2024, 0, 1 + i))), [locale]);
    const cells = monthGrid(view.getFullYear(), view.getMonth());
    const slots = useMemo(() => {
        const list = timeSlots(step);
        return parsed && !list.includes(parsed.time) ? [...list, parsed.time].sort() : list;
    }, [step, parsed]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    useEffect(() => {
        if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
    }, [open, focusDay]);

    const close = () => {
        setOpen(false);
        triggerRef.current?.focus();
    };
    const pickDay = (key: string) => {
        setFocusDay(key);
        onChange(`${key}T${parsed?.time ?? "23:59"}`);
    };
    const pickTime = (time: string) => onChange(`${parsed?.date ?? focusDay}T${time}`);

    const onGridKey = (e: KeyboardEvent) => {
        const delta = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7}[e.key];
        if (e.key === "Escape") {
            e.stopPropagation();
            close();
            return;
        }
        if (delta === undefined) return;
        e.preventDefault();
        const d = new Date(`${focusDay}T00:00`);
        d.setDate(d.getDate() + delta);
        setFocusDay(toDateKey(d));
        if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) {
            setView(new Date(d.getFullYear(), d.getMonth(), 1));
        }
    };

    const shown = parsed
        ? `${new Intl.DateTimeFormat(locale, {day: "2-digit", month: "2-digit", year: "numeric"}).format(new Date(`${parsed.date}T00:00`))}, ${parsed.time}`
        : null;

    return (
        <div ref={rootRef} className="relative">
            <div className="flex items-center gap-1">
                <button ref={triggerRef} id={id} type="button" disabled={disabled} aria-label={ariaLabel}
                        aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId}
                        onClick={() => setOpen(o => !o)}
                        className={cx("flex h-10 flex-1 items-center gap-2 rounded-[10px] border bg-sf px-3 text-left text-sm",
                            "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs disabled:cursor-not-allowed disabled:bg-s2",
                            open ? "border-pr" : "border-bd", shown ? "text-tx" : "text-mu/70")}>
                    <FiCalendar size={15} className="flex-none text-mu" aria-hidden="true"/>
                    {shown ?? placeholder ?? t("ui.pickDate")}
                </button>
                {value && !disabled && (
                    <button type="button" onClick={() => onChange(null)} aria-label={t("ui.clear")}
                            className="grid h-10 w-10 place-items-center rounded-[10px] text-mu hover:bg-s2 hover:text-tx focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
                        <FiX size={15} aria-hidden="true"/>
                    </button>
                )}
            </div>
            {open && (
                <div id={dialogId} role="dialog" aria-label={ariaLabel ?? t("ui.pickDate")}
                     className="absolute left-0 top-[calc(100%+6px)] z-40 flex w-[340px] gap-3 rounded-xl border border-bd bg-sf p-3 text-tx shadow-popover">
                    <div className="flex flex-1 flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[13px] font-semibold">
                            <button type="button" aria-label={t("ui.prevMonth")} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                                    className="grid h-6 w-6 place-items-center rounded-md hover:bg-s2"><FiChevronLeft size={14} aria-hidden="true"/></button>
                            <span className="capitalize">{monthTitle}</span>
                            <button type="button" aria-label={t("ui.nextMonth")} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                                    className="grid h-6 w-6 place-items-center rounded-md hover:bg-s2"><FiChevronRight size={14} aria-hidden="true"/></button>
                        </div>
                        <div ref={gridRef} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5 text-center text-xs">
                            {weekdays.map(w => <span key={w} className="capitalize text-mu">{w}</span>)}
                            {cells.map((d, i) => {
                                if (!d) return <span key={`pad-${i}`}/>;
                                const key = toDateKey(d);
                                const selected = parsed?.date === key;
                                return (
                                    <button key={key} type="button" data-day={key} tabIndex={key === focusDay ? 0 : -1}
                                            aria-pressed={selected} aria-current={key === today ? "date" : undefined}
                                            onClick={() => pickDay(key)}
                                            className={cx("grid h-6 place-items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr",
                                                selected ? "bg-pr font-bold text-white"
                                                    : key === today ? "border border-pr text-prt" : "text-tx hover:bg-s2")}>
                                        {d.getDate()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div role="listbox" aria-label={t("ui.time")} className="flex max-h-[200px] w-14 flex-col gap-0.5 overflow-auto text-center font-mono text-xs">
                        {slots.map(slot => (
                            <button key={slot} type="button" role="option" aria-selected={parsed?.time === slot}
                                    onClick={() => pickTime(slot)}
                                    className={cx("rounded-md p-1", parsed?.time === slot ? "bg-pr text-white" : "text-mu hover:bg-s2 hover:text-tx")}>
                                {slot}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
