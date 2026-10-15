import {cloneElement, type ReactElement, type ReactNode, useId, useState} from "react";
import {cx} from "./cx";

/**
 * Hover/focus tooltip (Components.dc.html — "Тосты и тултип"). Also used to explain
 * a disabled action (ТЗ 2.3): wrap the disabled button in a span so it still gets hover.
 */
export function Tooltip({content, kbd, children, side = "top", className}: {
    content: ReactNode;
    kbd?: string;
    children: ReactElement<{ "aria-describedby"?: string }>;
    side?: "top" | "bottom";
    className?: string;
}) {
    const id = useId();
    const [open, setOpen] = useState(false);
    return (
        <span className={cx("relative inline-flex", className)}
              onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
              onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
              onKeyDown={e => e.key === "Escape" && setOpen(false)}>
            {cloneElement(children, {"aria-describedby": id})}
            <span id={id} role="tooltip" data-theme="dark"
                  className={cx("pointer-events-none absolute left-1/2 z-[70] -translate-x-1/2 whitespace-nowrap rounded-[7px] bg-inv px-[9px] py-1.5 text-xs text-white",
                      side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
                      open ? "visible opacity-100" : "invisible opacity-0")}>
                {content}
                {kbd && <kbd className="ml-1.5 font-mono opacity-70">{kbd}</kbd>}
            </span>
        </span>
    );
}
