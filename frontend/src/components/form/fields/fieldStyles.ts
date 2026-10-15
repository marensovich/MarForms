import {cx} from "../../../ui";

// Shared look of public form fields (docs/design/mockups/FormDesktop.dc.html, FormPublic.dc.html):
// 48 px controls with 12 px corners on phones, 42 px / 10 px from 640 px up.

/** Ids that tie a field's label, description and error to its control (ТЗ 8.4). */
export function fieldIds(fieldId: string) {
    return {input: `f-${fieldId}`, description: `f-${fieldId}-desc`, error: `f-${fieldId}-error`};
}

/** aria-describedby of a control: its description and its error, when shown. */
export function describedBy(fieldId: string, hasDescription: boolean, hasError: boolean): string | undefined {
    const ids = fieldIds(fieldId);
    return [hasDescription && ids.description, hasError && ids.error].filter(Boolean).join(" ") || undefined;
}

export function inputClass(error?: string, extra?: string) {
    return cx(
        "w-full rounded-xl border bg-sf px-3.5 text-[15px] text-tx placeholder:text-mu/70 transition-colors sm:rounded-[10px] sm:px-3",
        "focus:border-pr focus:outline focus:outline-[3px] focus:outline-prs",
        error ? "border-[1.5px] border-dg focus:outline-rdb" : "border-bd",
        extra ?? "h-12 sm:h-[42px]",
    );
}

/** Option card of a single-choice field; the chosen one is outlined in indigo. */
export function optionCardClass(selected: boolean) {
    return cx("flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-[10px] px-3.5 py-3 text-sm transition-colors",
        "focus-within:outline focus-within:outline-[3px] focus-within:outline-prs",
        selected ? "border-[1.5px] border-pr bg-prs font-medium text-tx" : "border border-bd bg-sf text-tx hover:bg-bg");
}
