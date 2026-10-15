import {type RefObject, useEffect, useRef} from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside an open dialog (ТЗ 8.4): focuses the element with
 * data-autofocus (or the first focusable), cycles Tab, calls onEscape on Esc and
 * gives focus back to the opener on close. Also locks page scroll.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
    const onEscapeRef = useRef(onEscape);
    useEffect(() => {
        onEscapeRef.current = onEscape;
    });

    useEffect(() => {
        if (!active) return;
        const opener = document.activeElement as HTMLElement | null;
        const node = ref.current;
        const items = () => node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
        (node?.querySelector<HTMLElement>("[data-autofocus]") ?? items()[0] ?? node)?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && onEscapeRef.current) {
                e.stopPropagation();
                onEscapeRef.current();
                return;
            }
            if (e.key !== "Tab" || !node) return;
            const list = items();
            if (list.length === 0) {
                e.preventDefault();
                return;
            }
            const first = list[0], last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKey, true);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = overflow;
            opener?.focus?.();
        };
    }, [active, ref]);
}
