// Deprecated: the pre-redesign dashboard kit. New screens use src/ui (#105):
// TabSkeleton → DataTable loading / Skeleton, EmptyState → ui EmptyState, Badge → ui Badge,
// StatsCard → KpiCard, Modal → ui Modal, ConfirmModal → ConfirmDialog, ActionBtn → RowAction.
// Removed once the last admin screen moves over (#142–#148).
import {type ReactNode} from "react";
import {motion} from "framer-motion";
import {FiX} from "react-icons/fi";
import {useTranslation} from "react-i18next";

export function TabSkeleton({rows = 5}: { rows?: number }) {
    return (
        <div className="flex flex-col gap-2 animate-pulse">
            {[...Array(rows)].map((_, i) => (
                <div
                    key={i}
                    className="h-14 rounded-xl bg-s2"
                    style={{opacity: 1 - i * 0.14}}
                />
            ))}
        </div>
    );
}

export function EmptyState({message, icon}: { message: string; icon?: ReactNode }) {
    return (
        <div
            className="flex flex-col h-52 items-center justify-center gap-3 rounded-xl border border-dashed border-bd">
            {icon && <div className="text-4xl text-mu/70">{icon}</div>}
            <p className="text-sm text-mu">{message}</p>
        </div>
    );
}

export function TabHeader({
                              title,
                              count,
                              noun,
                              action,
                          }: {
    title: string;
    count: number;
    noun: string;
    action?: ReactNode;
}) {
    return (
        <div className="mb-6 flex items-start justify-between">
            <div>
                <h1 className="text-xl font-semibold text-tx">{title}</h1>
                <p className="mt-0.5 text-sm text-mu">
                    {count} {noun}{count !== 1 ? "s" : ""}
                </p>
            </div>
            {action}
        </div>
    );
}

export function Badge({
                          children,
                          color = "default",
                          dot = false,
                      }: {
    children: ReactNode;
    color?: "default" | "green" | "red" | "orange" | "indigo" | "blue" | "purple";
    dot?: boolean;
}) {
    const styles: Record<string, string> = {
        default: "border-bd bg-s2 text-mu",
        green: "border-gnb bg-gnb text-gnt",
        red: "border-rdb bg-rdb text-rdt",
        orange: "border-amb bg-amb text-amt",
        indigo: "border-prs bg-prs text-prt",
        blue: "border-inb bg-inb text-int",
        purple: "border-prs bg-prs text-prt",
    };
    const dotColors: Record<string, string> = {
        default: "bg-mu",
        green: "bg-ok",
        red: "bg-dg",
        orange: "bg-wr",
        indigo: "bg-pr",
        blue: "bg-int",
        purple: "bg-pr",
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${styles[color]}`}>
            {dot && <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColors[color]}`}/>}
            {children}
        </span>
    );
}

export function StatsCard({
                              label,
                              value,
                              sub,
                              icon,
                              accentColor = "rgb(var(--prt))",
                          }: {
    label: string;
    value: string | number;
    sub?: string;
    icon: ReactNode;
    accentColor?: string;
}) {
    return (
        <div className="relative overflow-hidden rounded-xl border border-bd bg-sf p-5">
            <div
                className="absolute bottom-0 left-0 h-px w-3/4"
                style={{background: `linear-gradient(to right, color-mix(in srgb, ${accentColor} 38%, transparent), transparent)`}}
            />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-mu">{label}</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-tx">{value}</p>
                    {sub && <p className="mt-0.5 truncate text-xs text-mu">{sub}</p>}
                </div>
                <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{background: `color-mix(in srgb, ${accentColor} 9%, transparent)`, color: accentColor}}
                >
                    {icon}
                </div>
            </div>
        </div>
    );
}

export function Modal({
                          title,
                          subtitle,
                          children,
                          onClose,
                          width = "max-w-md",
                      }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    onClose: () => void;
    width?: string;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{opacity: 0, scale: 0.96, y: 8}}
                animate={{opacity: 1, scale: 1, y: 0}}
                exit={{opacity: 0, scale: 0.96, y: 8}}
                transition={{duration: 0.18}}
                className={`relative z-10 w-full ${width} rounded-2xl border border-bd bg-sf shadow-xl`}
            >
                <div className="flex items-start justify-between border-b border-bd px-6 py-4">
                    <div>
                        <h2 className="text-sm font-semibold text-tx">{title}</h2>
                        {subtitle && (
                            <p className="mt-0.5 text-xs text-mu">{subtitle}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-4 -mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-mu transition-colors hover:bg-s2 hover:text-tx"
                    >
                        <FiX size={15}/>
                    </button>
                </div>
                <div className="px-6 py-5">{children}</div>
            </motion.div>
        </div>
    );
}

export function ConfirmModal({
                                 title,
                                 message,
                                 confirmLabel = "Confirm",
                                 confirmColor = "red",
                                 onConfirm,
                                 onCancel,
                             }: {
    title: string;
    message: string;
    confirmLabel?: string;
    confirmColor?: "red" | "indigo";
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const {t} = useTranslation();
    const btnCls =
        confirmColor === "red"
            ? "bg-dg hover:bg-dgh text-white"
            : "bg-pr hover:bg-prh text-white";

    return (
        <Modal title={title} onClose={onCancel} width="max-w-sm">
            <p className="mb-6 text-sm leading-relaxed text-mu">{message}</p>
            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="rounded-lg border border-bd px-4 py-2 text-sm text-mu transition-colors hover:text-tx"
                >
                    {t("common.cancel")}
                </button>
                <button
                    onClick={onConfirm}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${btnCls}`}
                >
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    );
}

export function SectionDivider({label}: { label: string }) {
    return (
        <div className="flex items-center gap-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wider text-mu">{label}</span>
            <div className="flex-1 border-t border-bd"/>
        </div>
    );
}

export function ActionBtn({
                              onClick,
                              variant = "ghost",
                              children,
                              disabled = false,
                              title,
                          }: {
    onClick?: () => void;
    variant?: "ghost" | "danger" | "warning" | "primary" | "success";
    children: ReactNode;
    disabled?: boolean;
    title?: string;
}) {
    const cls: Record<string, string> = {
        ghost: "text-mu hover:bg-s2 hover:text-tx",
        danger: "text-rdt hover:bg-rdb hover:text-rdt",
        warning: "text-amt hover:bg-amb hover:text-amt",
        primary: "text-prt hover:bg-prs hover:text-prt",
        success: "text-gnt hover:bg-gnb hover:text-gnt",
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`rounded-lg px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${cls[variant]}`}
        >
            {children}
        </button>
    );
}
