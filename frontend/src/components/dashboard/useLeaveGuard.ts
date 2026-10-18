import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

/**
 * Asks before leaving a page with unsaved changes (ТЗ 6.4): the browser's own
 * prompt on closing or reloading, and for in-app links a confirmation the page
 * shows. The app runs on a plain BrowserRouter, which has no navigation
 * blocker, so link clicks are caught on the document instead.
 *
 * @param dirty whether there is something to lose
 * @returns the link waiting for an answer, and how to answer
 */
export function useLeaveGuard(dirty: boolean) {
    const navigate = useNavigate();
    const [pending, setPending] = useState<string | null>(null);

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        const intercept = (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
            if (!link || link.target === "_blank" || link.origin !== window.location.origin) return;
            const to = link.pathname + link.search + link.hash;
            if (to === window.location.pathname + window.location.search + window.location.hash) return;
            e.preventDefault();
            e.stopPropagation();
            setPending(to);
        };
        window.addEventListener("beforeunload", warn);
        document.addEventListener("click", intercept, true);
        return () => {
            window.removeEventListener("beforeunload", warn);
            document.removeEventListener("click", intercept, true);
        };
    }, [dirty]);

    return {
        pending,
        leave: () => {
            const to = pending;
            setPending(null);
            if (to) navigate(to);
        },
        stay: () => setPending(null),
    };
}
