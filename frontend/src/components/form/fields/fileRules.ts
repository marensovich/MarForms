import type {FormField} from "../../../types/forms";

/* Mirrors backend FileRules.java — the server enforces these; the client
 * checks them first only to fail fast without uploading. */

export const MAX_FILE_SIZE_MB = 25;
export const DEFAULT_FILE_SIZE_MB = 10;
export const DEFAULT_FILE_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "doc", "docx", "xls", "xlsx", "zip"];

export function allowedExtensions(field: FormField): string[] {
    const configured = (field.allowedExtensions ?? [])
        .map(e => e.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean);
    return configured.length ? [...new Set(configured)] : DEFAULT_FILE_EXTENSIONS;
}

export function sizeLimitMb(field: FormField): number {
    return Math.min(field.maxFileSizeMb ?? DEFAULT_FILE_SIZE_MB, MAX_FILE_SIZE_MB);
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
