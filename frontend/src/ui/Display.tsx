import {type ReactNode, useState} from "react";
import {FiX} from "react-icons/fi";
import {colorFor, cx, initials} from "./cx";

// Docs: docs/design/mockups/Components.dc.html — "Статусы и чипы", "KPI, аватары, иконки серверов",
// the table's empty and error blocks.

export type Tone = "amber" | "green" | "red" | "primary" | "neutral" | "info";

const TONES: Record<Tone, string> = {
    amber: "bg-amb text-amt",
    green: "bg-gnb text-gnt",
    red: "bg-rdb text-rdt",
    primary: "bg-prs text-prt",
    neutral: "bg-s2 text-mu",
    info: "bg-inb text-int",
};

/** Status pill. Status is always text plus colour, never colour alone (ТЗ 8.4). */
export function Badge({tone = "neutral", size = "md", mono, children, className}: {
    tone?: Tone;
    size?: "sm" | "md";
    mono?: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full text-xs font-semibold",
            size === "md" ? "px-2.5 py-1" : "px-[9px] py-[3px]", mono && "font-mono font-medium", TONES[tone], className)}>
            {children}
        </span>
    );
}

/** A Discord role: chip with the role's colour dot, optionally removable. */
export function RoleChip({name, color, onRemove, removeLabel, className}: {
    name: string;
    /** CSS colour, see discordColor(). */
    color: string;
    onRemove?: () => void;
    removeLabel?: string;
    className?: string;
}) {
    return (
        <span className={cx("inline-flex items-center gap-1.5 rounded-full border border-bd bg-sf py-1 text-[13px] text-tx",
            onRemove ? "pl-2.5 pr-1.5" : "px-2.5", className)}>
            <span className="h-2 w-2 flex-none rounded-full" style={{background: color}} aria-hidden="true"/>
            {name}
            {onRemove && (
                <button type="button" onClick={onRemove} aria-label={removeLabel ?? name}
                        className="grid h-[18px] w-[18px] place-items-center rounded-full bg-s2 text-mu hover:text-tx focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr">
                    <FiX size={11} aria-hidden="true"/>
                </button>
            )}
        </span>
    );
}

/** Dashed "+ Добавить роль" chip. */
export function AddChip({children, onClick}: { children: ReactNode; onClick?: () => void }) {
    return (
        <button type="button" onClick={onClick}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-bd px-2.5 py-1 text-[13px] text-prt hover:border-pr focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
            {children}
        </button>
    );
}

const DISCORD_LOGO = "M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.5 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7z";

export function DiscordLogo({size = 18}: { size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={DISCORD_LOGO}/></svg>;
}

/**
 * User avatar: the Discord image; without one, an initial on a colour from the
 * name; if the image fails, the Discord logo (as in the mockup).
 */
export function Avatar({name, src, size = 36, className}: { name: string; src?: string | null; size?: number; className?: string }) {
    const [failed, setFailed] = useState(false);
    const style = {width: size, height: size, fontSize: Math.round(size * 0.4)};
    if (src && !failed) {
        return <img src={src} alt="" onError={() => setFailed(true)} style={style}
                    className={cx("flex-none rounded-full object-cover", className)}/>;
    }
    return (
        <span aria-hidden="true" style={failed ? style : {...style, background: colorFor(name)}}
              className={cx("grid flex-none place-items-center rounded-full font-semibold text-white", failed && "bg-discord", className)}>
            {failed ? <DiscordLogo size={Math.round(size / 2)}/> : initials(name)}
        </span>
    );
}

/** Server icon: image, or two letters on a colour; unknown server → dashed "?". */
export function ServerIcon({name, src, size = 36, className}: { name?: string | null; src?: string | null; size?: number; className?: string }) {
    const [failed, setFailed] = useState(false);
    const style = {width: size, height: size, borderRadius: Math.round(size * 0.3), fontSize: Math.round(size * 0.36)};
    if (src && !failed) {
        return <img src={src} alt="" onError={() => setFailed(true)} style={style} className={cx("flex-none object-cover", className)}/>;
    }
    if (!name) {
        return <span aria-hidden="true" style={style}
                     className={cx("grid flex-none place-items-center border-[1.5px] border-dashed border-bd font-bold text-mu", className)}>?</span>;
    }
    return (
        <span aria-hidden="true" style={{...style, background: colorFor(name)}}
              className={cx("grid flex-none place-items-center font-bold text-white", className)}>
            {initials(name, 2)}
        </span>
    );
}

export function KpiCard({label, value, extra, delta, deltaTone = "up", className}: {
    label: ReactNode;
    value: ReactNode;
    /** Shown after the value, e.g. "· 64%". */
    extra?: ReactNode;
    delta?: ReactNode;
    deltaTone?: "up" | "down" | "neutral";
    className?: string;
}) {
    return (
        <div className={cx("flex flex-col gap-1 rounded-[14px] border border-bd bg-sf px-[18px] py-4", className)}>
            <span className="text-[13px] text-mu">{label}</span>
            <span className="text-[26px] font-bold leading-tight tabular-nums text-tx">
                {value}{extra && <span className="text-sm font-medium text-mu"> {extra}</span>}
            </span>
            {delta && (
                <span className={cx("text-xs", deltaTone === "up" ? "text-gnt" : deltaTone === "down" ? "text-rdt" : "text-mu")}>
                    {delta}
                </span>
            )}
        </div>
    );
}

export function Skeleton({className}: { className?: string }) {
    return <span aria-hidden="true" className={cx("mf-skeleton block rounded-[5px] bg-s2", className)}/>;
}

export function EmptyState({title, text, action, className}: { title: ReactNode; text?: ReactNode; action?: ReactNode; className?: string }) {
    return (
        <div className={cx("flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-bd p-5 text-center text-[13px]", className)}>
            <b className="text-tx">{title}</b>
            {text && <span className="text-mu">{text}</span>}
            {action && <div className="mt-1">{action}</div>}
        </div>
    );
}

export function ErrorState({title, text, code, onRetry, retryLabel, className}: {
    title: ReactNode;
    text?: ReactNode;
    /** Technical code / request id, shown in mono. */
    code?: string;
    onRetry?: () => void;
    retryLabel?: string;
    className?: string;
}) {
    return (
        <div role="alert" className={cx("flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-rdt p-5 text-center text-[13px]", className)}>
            <b className="text-rdt">{title}</b>
            {text && <span className="text-mu">{text}</span>}
            {code && <span className="font-mono text-xs text-mu">{code}</span>}
            {onRetry && (
                <button type="button" onClick={onRetry}
                        className="rounded-md font-semibold text-prt hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
                    {retryLabel}
                </button>
            )}
        </div>
    );
}

export function Kbd({children}: { children: ReactNode }) {
    return <kbd className="rounded-md border border-bd px-1.5 py-0.5 font-mono text-[11px] text-mu">{children}</kbd>;
}
