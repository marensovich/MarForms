import type {FormField} from "../../types/forms";

/** An answer as text for a submission card; "—" when empty. */
export function formatAnswer(field: FormField | undefined, value: unknown, t: (k: string) => string): string {
    if (value === null || value === undefined || value === "") return "—";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
    if (typeof value === "boolean") return value ? t("moderation.card.yes") : t("moderation.card.no");
    if (field?.type === "DATETIME" && typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? value : d.toLocaleString();
    }
    return String(value);
}
