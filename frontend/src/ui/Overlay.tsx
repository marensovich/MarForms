import {type ReactNode, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {FiX} from "react-icons/fi";
import {useTranslation} from "react-i18next";
import {Button} from "./Button";
import {cx} from "./cx";
import {Input} from "./Field";
import {useFocusTrap} from "./useFocusTrap";

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    /** Width in px (mockup modals: 420–520, the submission card 1040). */
    width?: number;
    children?: ReactNode;
    footer?: ReactNode;
    role?: "dialog" | "alertdialog";
    /** Hide the × button (confirmations close with their buttons). */
    hideClose?: boolean;
    /** No padding around the body (lists that run edge to edge). */
    flush?: boolean;
}

// Docs: docs/design/mockups/AdminUsers.dc.html, AdminRoles.dc.html, AnonDialog.dc.html, Components "Модалка подтверждения".
export function Modal({open, onClose, title, description, width = 440, children, footer, role = "dialog", hideClose, flush}: ModalProps) {
    const {t} = useTranslation();
    const ref = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descId = useId();
    useFocusTrap(ref, open, onClose);
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ov p-4"
             onMouseDown={e => e.target === e.currentTarget && onClose()}>
            <div ref={ref} role={role} aria-modal="true" aria-labelledby={titleId}
                 aria-describedby={description ? descId : undefined} tabIndex={-1} style={{width}}
                 className="flex max-h-[calc(100vh-32px)] max-w-full flex-col rounded-2xl border border-bd bg-sf text-tx shadow-modal outline-none">
                <div className={cx("flex items-start gap-3", flush ? "border-b border-bd px-[22px] py-[18px]" : "px-[22px] pt-[22px]")}>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <h2 id={titleId} className="m-0 text-base font-bold">{title}</h2>
                        {description && <p id={descId} className="m-0 text-[13px] leading-normal text-mu">{description}</p>}
                    </div>
                    {!hideClose && (
                        <button type="button" onClick={onClose} aria-label={t("ui.close")}
                                className="grid h-8 w-8 flex-none place-items-center rounded-[9px] border border-bd bg-sf text-mu hover:bg-s2 hover:text-tx focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
                            <FiX size={16} aria-hidden="true"/>
                        </button>
                    )}
                </div>
                {children && <div className={cx("min-h-0 flex-1 overflow-auto", flush ? "" : "px-[22px] pt-3.5")}>{children}</div>}
                {footer
                    ? <div className={cx("flex justify-end gap-2", flush ? "border-t border-bd px-[22px] py-3.5" : "p-[22px] pt-4")}>{footer}</div>
                    : !flush && <div className="h-[22px]"/>}
            </div>
        </div>,
        document.body,
    );
}

export interface ConfirmDialogProps {
    open: boolean;
    title: ReactNode;
    text?: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: "danger" | "primary";
    /** May return a promise; the button shows a spinner until it settles. */
    onConfirm: () => void | Promise<unknown>;
    onCancel: () => void;
    /** Confirm stays disabled until this exact text is typed (e.g. the form's slug). */
    requireText?: string;
    requireLabel?: ReactNode;
    children?: ReactNode;
}

/** Confirmation for irreversible actions (ТЗ 6.0). */
export function ConfirmDialog({open, title, text, confirmLabel, cancelLabel, tone = "danger", onConfirm, onCancel,
                                  requireText, requireLabel, children}: ConfirmDialogProps) {
    const {t} = useTranslation();
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);
    const inputId = useId();
    const blocked = requireText !== undefined && typed.trim() !== requireText;

    const close = () => {
        if (busy) return;
        setTyped("");
        onCancel();
    };
    const confirm = async () => {
        if (blocked) return;
        setBusy(true);
        try {
            await onConfirm();
            setTyped("");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={open} onClose={close} title={title} description={text} role="alertdialog" hideClose
               footer={<>
                   <Button variant="secondary" size="sm" onClick={close} disabled={busy}>{cancelLabel ?? t("ui.cancel")}</Button>
                   <Button variant={tone === "danger" ? "danger" : "primary"} size="sm" onClick={confirm}
                           disabled={blocked} loading={busy} data-autofocus={requireText ? undefined : true}>
                       {confirmLabel}
                   </Button>
               </>}>
            {(children || requireText !== undefined) && (
                <div className="flex flex-col gap-3">
                    {children}
                    {requireText !== undefined && (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={inputId} className="text-[13px] text-mu">
                                {requireLabel ?? t("ui.typeToConfirm")} <code className="font-mono text-tx">{requireText}</code>
                            </label>
                            <Input id={inputId} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off"
                                   spellCheck={false} data-autofocus className="font-mono"/>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

export interface DrawerProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    subtitle?: ReactNode;
    /** Avatar or icon left of the title. */
    leading?: ReactNode;
    /** 520 (My submissions) or 560 (admin submission card). */
    width?: number;
    children: ReactNode;
    footer?: ReactNode;
}

// Docs: docs/design/mockups/AdminResponses.dc.html, MySubsDesktop.dc.html; Components "Боковая панель".
export function Drawer({open, onClose, title, subtitle, leading, width = 520, children, footer}: DrawerProps) {
    const {t} = useTranslation();
    const ref = useRef<HTMLDivElement>(null);
    const titleId = useId();
    useFocusTrap(ref, open, onClose);
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-ov" onMouseDown={e => e.target === e.currentTarget && onClose()}>
            <aside ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={{width}}
                   className="flex h-full max-w-full flex-col border-l border-bd bg-sf text-tx shadow-drawer outline-none">
                <div className="flex items-start gap-3 border-b border-bd px-[22px] py-[18px]">
                    {leading}
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <h2 id={titleId} className="m-0 truncate text-[17px] font-bold">{title}</h2>
                        {subtitle && <span className="text-xs text-mu">{subtitle}</span>}
                    </div>
                    <button type="button" onClick={onClose} aria-label={t("ui.close")}
                            className="grid h-8 w-8 flex-none place-items-center rounded-[9px] border border-bd bg-sf text-mu hover:bg-s2 hover:text-tx focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
                        <FiX size={16} aria-hidden="true"/>
                    </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-[22px] py-[18px]">{children}</div>
                {footer && <div className="flex gap-2 border-t border-bd px-[22px] py-3.5">{footer}</div>}
            </aside>
        </div>,
        document.body,
    );
}
