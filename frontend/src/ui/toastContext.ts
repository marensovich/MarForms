import {createContext, type ReactNode, useContext} from "react";

// Docs: docs/design/mockups/Components.dc.html — "Тосты и тултип". Bottom-right (ФТ-4.1.4).

export interface ToastOptions {
    tone?: "success" | "error" | "info";
    text: ReactNode;
    /** E.g. "Отменить" or "Детали"; the toast closes after the click. */
    action?: { label: string; onClick: () => void };
    /** ms; errors stay twice as long by default. */
    duration?: number;
}

export const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

export function useToast(): (options: ToastOptions) => void {
    const show = useContext(ToastContext);
    if (!show) throw new Error("useToast needs <ToastProvider>");
    return show;
}
