// The language a user picked themselves (ТЗ 8.3): it wins over the platform's
// default. Kept apart from i18n.ts so screens can use it without loading i18next.

const STORAGE_KEY = "mf.lang";
export const SUPPORTED_LANGUAGES = ["ru", "en"];

/** The language the user picked, if any. */
export function chosenLanguage(): string | null {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v && SUPPORTED_LANGUAGES.includes(v) ? v : null;
    } catch {
        return null;
    }
}

/** Remembers the user's pick; the caller switches i18n. */
export function rememberLanguage(code: string) {
    try {
        localStorage.setItem(STORAGE_KEY, code);
    } catch {
        // Private mode: the choice lasts until the page is closed.
    }
}
