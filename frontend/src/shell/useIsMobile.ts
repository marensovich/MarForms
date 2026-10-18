import {useSyncExternalStore} from "react";

/** The phone layout (ТЗ 4.10, 8.2): below Tailwind's md, 768 px. */
const QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
    if (typeof window.matchMedia !== "function") return () => undefined;
    const media = window.matchMedia(QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

const snapshot = () => typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;

/** Whether the screen is phone-sized; follows rotation and resizing. */
export function useIsMobile(): boolean {
    return useSyncExternalStore(subscribe, snapshot, () => false);
}
