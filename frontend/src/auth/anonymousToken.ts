const ANONYMOUS_TOKEN_KEY = "marforms_anonymous_token";

let memoryToken: string | null = null;

function randomToken(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

/**
 * A random per-browser token sent with submissions to ANONYMOUS forms
 * (E2.3). It identifies nobody: the server stores only a per-form hash of
 * it, to apply the per-person limit to this browser. Falls back to a
 * per-tab token when storage is unavailable.
 */
/** The token if this browser already has one — without creating it (reading a form page). */
export function peekAnonymousToken(): string | null {
    try {
        return localStorage.getItem(ANONYMOUS_TOKEN_KEY) ?? memoryToken;
    } catch {
        return memoryToken;
    }
}

export function getAnonymousToken(): string {
    try {
        const stored = localStorage.getItem(ANONYMOUS_TOKEN_KEY);
        if (stored) return stored;
        const token = randomToken();
        localStorage.setItem(ANONYMOUS_TOKEN_KEY, token);
        return token;
    } catch {
        memoryToken ??= randomToken();
        return memoryToken;
    }
}
