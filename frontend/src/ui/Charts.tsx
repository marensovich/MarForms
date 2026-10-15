import {cx} from "./cx";
import {areaPoints} from "./helpers";

// Docs: docs/design/mockups/Components.dc.html — "Gauge, area chart, diff"; AdminSystem.dc.html.

export type ChartTone = "pr" | "wr" | "ok" | "dg";

/** Ring gauge with the percentage in the middle (CPU, RAM, disk). */
export function Gauge({value, label, tone = "pr", size = 72}: { value: number; label: string; tone?: ChartTone; size?: number }) {
    const pct = Math.max(0, Math.min(100, value));
    const r = 34, c = 2 * Math.PI * r;
    return (
        <svg width={size} height={size} viewBox="0 0 84 84" role="img" aria-label={`${label} ${Math.round(pct)}%`}>
            <circle cx="42" cy="42" r={r} fill="none" stroke="rgb(var(--s2))" strokeWidth="9"/>
            <circle cx="42" cy="42" r={r} fill="none" stroke={`rgb(var(--${tone}))`} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 42 42)"/>
            <text x="42" y="47" textAnchor="middle" fontSize="17" fontWeight="700" fill="rgb(var(--tx))" fontFamily="Onest, sans-serif">
                {Math.round(pct)}%
            </text>
        </svg>
    );
}

/** Small area chart (last 5 minutes of a metric). Decorative: the number is shown next to it. */
export function AreaChart({values, max, tone = "pr", height = 50, className}: {
    values: number[]; max?: number; tone?: ChartTone; height?: number; className?: string;
}) {
    const width = 160;
    const pts = areaPoints(values, width, height, max);
    if (pts.length === 0) return <svg viewBox={`0 0 ${width} ${height}`} className={className} style={{height}} aria-hidden="true"/>;
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
    const color = `rgb(var(--${tone}))`;
    return (
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cx("w-full", className)} style={{height}} aria-hidden="true">
            <path d={`${line} L${pts[pts.length - 1][0]},${height} L0,${height} Z`} fill={color} fillOpacity="0.12"/>
            <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/>
        </svg>
    );
}

export interface DiffRow {
    field: string;
    before?: string | null;
    after?: string | null;
}

/** Audit "было / стало" (ТЗ 6.5). */
export function DiffView({rows, className}: { rows: DiffRow[]; className?: string }) {
    return (
        <div className={cx("overflow-hidden rounded-[10px] border border-bd font-mono text-xs", className)}>
            {rows.map(r => (
                <div key={r.field}>
                    {r.before != null && <div className="bg-rdb px-2.5 py-1.5 text-rdt"><span aria-hidden="true">− </span>{r.field}: {r.before}</div>}
                    {r.after != null && <div className="bg-gnb px-2.5 py-1.5 text-gnt"><span aria-hidden="true">+ </span>{r.field}: {r.after}</div>}
                </div>
            ))}
        </div>
    );
}
