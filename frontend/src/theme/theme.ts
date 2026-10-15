import {useSyncExternalStore} from "react";

/**
 * Light / dark theme (ТЗ 8.3, #104). The preference is "system" by default and
 * follows prefers-color-scheme; a manual choice is kept in localStorage. The
 * inline script in index.html applies the same rule before first paint.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "marforms.theme";

const listeners = new Set<() => void>();

export function readPreference(): ThemePreference {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        return stored === "light" || stored === "dark" ? stored : "system";
    } catch {
        return "system";
    }
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
    if (pref === "system") return systemDark ? "dark" : "light";
    return pref;
}

function systemDark(): boolean {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply() {
    document.documentElement.dataset.theme = resolveTheme(readPreference(), systemDark());
    listeners.forEach(listener => listener());
}

export function setThemePreference(pref: ThemePreference) {
    try {
        if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
        else localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
        // Private mode: the choice lasts for this page only.
    }
    apply();
}

/** Re-applies the theme when the OS setting changes while the preference is "system". */
export function watchSystemTheme(): () => void {
    if (typeof window.matchMedia !== "function") return () => undefined;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => readPreference() === "system" && apply();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useTheme(): { preference: ThemePreference; theme: ResolvedTheme; setPreference: (p: ThemePreference) => void } {
    const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
    const theme = useSyncExternalStore(subscribe,
        () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light") as ResolvedTheme,
        () => "light" as const);
    return {preference, theme, setPreference: setThemePreference};
}
