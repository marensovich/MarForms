import {cx} from "./cx";

// Non-component helpers of the UI kit (kept apart for React fast refresh).

/** Page buttons: 1 2 3 … 14 — the first, the last and the neighbours of the current one (1-based). */
export function pageList(current: number, count: number): (number | "…")[] {
    if (count <= 7) return Array.from({length: count}, (_, i) => i + 1);
    const pages = new Set([1, count, current - 1, current, current + 1].filter(p => p >= 1 && p <= count));
    const sorted = [...pages].sort((a, b) => a - b);
    const out: (number | "…")[] = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
        out.push(p);
    });
    return out;
}

/** Path points of an area chart scaled into a width × height box. */
export function areaPoints(values: number[], width: number, height: number, max?: number): [number, number][] {
    if (values.length === 0) return [];
    const top = max ?? Math.max(...values, 1);
    const step = values.length > 1 ? width / (values.length - 1) : 0;
    return values.map((v, i) => [+(i * step).toFixed(1), +(height - (Math.max(0, v) / top) * (height - 4)).toFixed(1)]);
}

const pad = (n: number) => String(n).padStart(2, "0");

export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Splits a local "YYYY-MM-DDTHH:mm[:ss]" value. */
export function parseLocal(value: string | null | undefined): { date: string; time: string } | null {
    const m = value?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return m ? {date: m[1], time: m[2]} : null;
}

/** Day cells of a month view, Monday first; null pads the first week. */
export function monthGrid(year: number, month: number): (Date | null)[] {
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
    return cells;
}

/** Times offered in the list: every `step` minutes plus 23:59 (end of day, as in the mockup). */
export function timeSlots(step: number): string[] {
    const out: string[] = [];
    for (let m = 0; m < 24 * 60; m += step) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    if (!out.includes("23:59")) out.push("23:59");
    return out;
}

/** Underlined tab look; for route tabs pass it to NavLink's className. */
export function tabClassName(active: boolean) {
    return cx("inline-flex items-center gap-1.5 border-b-2 py-2 text-sm transition-colors",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs",
        active ? "border-pr font-semibold text-tx" : "border-transparent text-mu hover:text-tx");
}
