import {ApiError} from "./client";

/**
 * Turns an API failure into a readable message. Backend errors are JSON
 * `{"error": "..."}`, optionally with `"fields": {path: message}` for
 * per-field validation failures (see GlobalExceptionHandler).
 */
export function describeApiError(e: unknown, fallback: string): string {
    if (!(e instanceof ApiError)) return fallback;
    try {
        const parsed = JSON.parse(e.message);
        if (parsed && typeof parsed === "object") {
            const fields = parsed.fields && typeof parsed.fields === "object"
                ? Object.values(parsed.fields as Record<string, string>)
                : [];
            if (parsed.error) return fields.length ? `${parsed.error}: ${fields.join("; ")}` : parsed.error;
            const values = Object.values(parsed as Record<string, unknown>).filter(v => typeof v === "string");
            if (values.length) return values.join("; ");
        }
    } catch {
        // not JSON — fall through to the raw text
    }
    return e.message || fallback;
}
