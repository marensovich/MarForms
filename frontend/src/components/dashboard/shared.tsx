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
                    className="h-14 rounded-xl bg-[#F0F0F2]"
                    style={{opacity: 1 - i * 0.14}}
                />
            ))}
        </div>
    );
}

export function EmptyState({message, icon}: { message: string; icon?: ReactNode }) {
    return (
        <div
            className="flex flex-col h-52 items-center justify-center gap-3 rounded-xl border border-dashed border-[#D4D4D9]">
            {icon && <div className="text-4xl text-[#C7C7CE]">{icon}</div>}
            <p className="text-sm text-[#8B8B96]">{message}</p>
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
                <h1 className="text-xl font-semibold text-[#1E1E24]">{title}</h1>
                <p className="mt-0.5 text-sm text-[#6B6B76]">
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
        default: "border-[#E4E4E7] bg-[#F0F0F2] text-[#55555F]",
        green: "border-[#D7E8D9] bg-[#EEF4EE] text-[#3F6B4A]",
        red: "border-[#EAD4D3] bg-[#F7EEEE] text-[#8B4A46]",
        orange: "border-[#EFDFC0] bg-[#FBF3E4] text-[#92702A]",
        indigo: "border-[#D8DCF5] bg-[#EEF0FB] text-[#3730A3]",
        blue: "border-[#CFE0F5] bg-[#EAF1FB] text-[#31578F]",
        purple: "border-[#E0D5F2] bg-[#F2EEFA] text-[#5B3E96]",
    };
    const dotColors: Record<string, string> = {
        default: "bg-[#9A9AA4]",
        green: "bg-[#5C8F6A]",
        red: "bg-[#B56A65]",
        orange: "bg-[#C99A3E]",
        indigo: "bg-[#3730A3]",
        blue: "bg-[#4A78B5]",
        purple: "bg-[#7C5CB5]",
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
                              accentColor = "#3730A3",
                          }: {
    label: string;
    value: string | number;
    sub?: string;
    icon: ReactNode;
    accentColor?: string;
}) {
    return (
        <div className="relative overflow-hidden rounded-xl border border-[#E4E4E7] bg-white p-5">
            <div
                className="absolute bottom-0 left-0 h-px w-3/4"
                style={{background: `linear-gradient(to right, ${accentColor}60, transparent)`}}
            />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-[#6B6B76]">{label}</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-[#1E1E24]">{value}</p>
                    {sub && <p className="mt-0.5 truncate text-xs text-[#8B8B96]">{sub}</p>}
                </div>
                <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{background: `${accentColor}18`, color: accentColor}}
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
                className={`relative z-10 w-full ${width} rounded-2xl border border-[#E4E4E7] bg-white shadow-xl`}
            >
                <div className="flex items-start justify-between border-b border-[#E4E4E7] px-6 py-4">
                    <div>
                        <h2 className="text-sm font-semibold text-[#1E1E24]">{title}</h2>
                        {subtitle && (
                            <p className="mt-0.5 text-xs text-[#6B6B76]">{subtitle}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-4 -mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[#8B8B96] transition-colors hover:bg-[#F0F0F2] hover:text-[#1E1E24]"
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
            ? "bg-[#B54B45] hover:bg-[#9C3F3A] text-white"
            : "bg-[#3730A3] hover:bg-[#2D2682] text-white";

    return (
        <Modal title={title} onClose={onCancel} width="max-w-sm">
            <p className="mb-6 text-sm leading-relaxed text-[#55555F]">{message}</p>
            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="rounded-lg border border-[#E4E4E7] px-4 py-2 text-sm text-[#55555F] transition-colors hover:text-[#1E1E24]"
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
            <span className="text-xs font-medium uppercase tracking-wider text-[#8B8B96]">{label}</span>
            <div className="flex-1 border-t border-[#E4E4E7]"/>
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
        ghost: "text-[#6B6B76] hover:bg-[#F0F0F2] hover:text-[#1E1E24]",
        danger: "text-[#B56A65] hover:bg-[#F7EEEE] hover:text-[#8B4A46]",
        warning: "text-[#C99A3E] hover:bg-[#FBF3E4] hover:text-[#92702A]",
        primary: "text-[#3730A3] hover:bg-[#EEF0FB] hover:text-[#2D2682]",
        success: "text-[#5C8F6A] hover:bg-[#EEF4EE] hover:text-[#3F6B4A]",
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
