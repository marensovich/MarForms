import {type ReactNode, useCallback, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {ToastContext, type ToastOptions} from "./toastContext";

interface ToastItem extends ToastOptions {
    id: number;
}

const ICON = {success: "✓", error: "!", info: "i"};
const ICON_TONE = {success: "text-gnt", error: "text-rdt", info: "text-prt"};

export function ToastProvider({children}: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id: number) => setItems(list => list.filter(t => t.id !== id)), []);
    const show = useCallback((options: ToastOptions) => {
        const id = nextId.current++;
        setItems(list => [...list.slice(-3), {...options, id}]);
        const duration = options.duration ?? (options.tone === "error" ? 10000 : 5000);
        window.setTimeout(() => dismiss(id), duration);
    }, [dismiss]);

    const value = useMemo(() => show, [show]);
    return (
        <ToastContext.Provider value={value}>
            {children}
            {createPortal(
                // data-theme="dark": toasts are dark in both themes, so the dark tokens give their accents.
                <div data-theme="dark" aria-live="polite" role="status"
                     className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2">
                    {items.map(item => {
                        const tone = item.tone ?? "success";
                        return (
                            <div key={item.id}
                                 className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-inv px-3.5 py-3 text-[13px] text-white shadow-popover">
                                <span aria-hidden="true" className={`font-bold ${ICON_TONE[tone]}`}>{ICON[tone]}</span>
                                <span className="flex-1">{item.text}</span>
                                {item.action && (
                                    <button type="button" onClick={() => {
                                        item.action!.onClick();
                                        dismiss(item.id);
                                    }} className="rounded font-semibold text-prt focus-visible:outline focus-visible:outline-2 focus-visible:outline-prt">
                                        {item.action.label}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>,
                document.body,
            )}
        </ToastContext.Provider>
    );
}
