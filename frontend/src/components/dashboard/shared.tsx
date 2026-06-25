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
                    className="h-14 rounded-xl bg-white/[0.05]"
                    style={{opacity: 1 - i * 0.14}}
                />
            ))}
        </div>
    );
}

export function EmptyState({message, icon}: { message: string; icon?: ReactNode }) {
    return (
        <div
            className="flex flex-col h-52 items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.12]">
            {icon && <div className="text-4xl text-white/20">{icon}</div>}
            <p className="text-sm text-white/45">{message}</p>
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
                <h1 className="text-xl font-semibold text-white">{title}</h1>
                <p className="mt-0.5 text-sm text-white/55">
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
        default: "border-white/[0.10] bg-white/[0.08] text-white/65",
        green: "border-emerald-500/25 bg-emerald-500/15 text-emerald-300",
        red: "border-red-500/25 bg-red-500/15 text-red-300",
        orange: "border-orange-500/25 bg-orange-500/15 text-orange-300",
        indigo: "border-indigo-500/25 bg-indigo-500/15 text-indigo-200",
        blue: "border-blue-500/25 bg-blue-500/15 text-blue-200",
        purple: "border-purple-500/25 bg-purple-500/15 text-purple-200",
    };
    const dotColors: Record<string, string> = {
        default: "bg-white/60",
        green: "bg-emerald-400",
        red: "bg-red-400",
        orange: "bg-orange-400",
        indigo: "bg-indigo-400",
        blue: "bg-blue-400",
        purple: "bg-purple-400",
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
                              accentColor = "#6366f1",
                          }: {
    label: string;
    value: string | number;
    sub?: string;
    icon: ReactNode;
    accentColor?: string;
}) {
    return (
        <div className="relative overflow-hidden rounded-xl border border-white/[0.11] bg-white/[0.04] p-5">
            <div
                className="absolute bottom-0 left-0 h-px w-3/4"
                style={{background: `linear-gradient(to right, ${accentColor}60, transparent)`}}
            />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-white/55">{label}</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</p>
                    {sub && <p className="mt-0.5 truncate text-xs text-white/45">{sub}</p>}
                </div>
                <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{background: `${accentColor}20`, color: accentColor}}
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
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{opacity: 0, scale: 0.96, y: 8}}
                animate={{opacity: 1, scale: 1, y: 0}}
                exit={{opacity: 0, scale: 0.96, y: 8}}
                transition={{duration: 0.18}}
                className={`relative z-10 w-full ${width} rounded-2xl border border-white/[0.12] bg-[#181830] shadow-2xl`}
            >
                <div className="flex items-start justify-between border-b border-white/[0.10] px-6 py-4">
                    <div>
                        <h2 className="text-sm font-semibold text-white">{title}</h2>
                        {subtitle && (
                            <p className="mt-0.5 text-xs text-white/55">{subtitle}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-4 -mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white"
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
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-indigo-600 hover:bg-indigo-500 text-white";

    return (
        <Modal title={title} onClose={onCancel} width="max-w-sm">
            <p className="mb-6 text-sm leading-relaxed text-white/70">{message}</p>
            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="rounded-lg border border-white/[0.12] px-4 py-2 text-sm text-white/60 transition-colors hover:text-white"
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
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">{label}</span>
            <div className="flex-1 border-t border-white/[0.08]"/>
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
        ghost: "text-white/60 hover:bg-white/[0.07] hover:text-white",
        danger: "text-red-400 hover:bg-red-500/12 hover:text-red-300",
        warning: "text-orange-400 hover:bg-orange-500/12 hover:text-orange-300",
        primary: "text-indigo-300 hover:bg-indigo-500/12 hover:text-indigo-200",
        success: "text-emerald-400 hover:bg-emerald-500/12 hover:text-emerald-300",
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
