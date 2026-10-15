import {type ButtonHTMLAttributes, forwardRef, type ReactNode} from "react";
import {cx} from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerSoft" | "discord";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

// Docs: docs/design/mockups/Components.dc.html — "Кнопки · default / hover / focus / disabled".
const VARIANTS: Record<ButtonVariant, string> = {
    primary: "bg-pr text-white font-semibold hover:bg-prh focus-visible:outline-pr/30 focus-visible:outline-offset-2 disabled:opacity-45 disabled:hover:bg-pr",
    secondary: "border border-bd bg-sf text-tx hover:bg-s2 focus-visible:border-pr focus-visible:outline-prs disabled:opacity-60 disabled:text-mu disabled:hover:bg-sf",
    ghost: "text-prt font-medium hover:bg-prs focus-visible:outline-prs disabled:text-mu disabled:hover:bg-transparent",
    danger: "bg-dg text-white font-semibold hover:bg-dgh focus-visible:outline-dg/30 focus-visible:outline-offset-2 disabled:opacity-45 disabled:hover:bg-dg",
    dangerSoft: "border border-rdb bg-rdb text-rdt font-semibold hover:border-rdt/40 focus-visible:outline-rdb disabled:opacity-60",
    discord: "bg-discord text-white font-semibold hover:bg-discord-hover focus-visible:outline-discord/40 focus-visible:outline-offset-2 disabled:opacity-60",
};

const SIZES: Record<ButtonSize, string> = {
    xs: "h-[30px] px-2.5 text-[13px] rounded-lg",
    sm: "h-[34px] px-3 text-[13px] rounded-[9px]",
    md: "h-[38px] px-3.5 text-sm rounded-[10px]",
    lg: "h-[46px] px-5 text-[15px] rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: ReactNode;
    block?: boolean;
}

export function Spinner({className}: { className?: string }) {
    return <span aria-hidden="true"
                 className={cx("inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent", className)}/>;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {variant = "primary", size = "md", loading = false, icon, block, className, children, disabled, type = "button", ...rest},
    ref,
) {
    return (
        <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
                className={cx(
                    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans transition-colors",
                    "focus-visible:outline focus-visible:outline-[3px] disabled:cursor-not-allowed",
                    VARIANTS[variant], SIZES[size], block && "w-full", className)}
                {...rest}>
            {loading ? <Spinner/> : icon}
            {children}
        </button>
    );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** Accessible name — required, the button has no text. */
    label: string;
    size?: "sm" | "md" | "lg";
    tone?: "default" | "muted" | "danger";
}

const ICON_SIZES = {sm: "h-7 w-7 rounded-lg", md: "h-8 w-8 rounded-[9px]", lg: "h-10 w-10 rounded-xl"};

/** Square icon-only button (copy, close, row actions). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    {label, size = "md", tone = "default", className, children, type = "button", ...rest}, ref,
) {
    return (
        <button ref={ref} type={type} aria-label={label}
                className={cx("grid flex-none place-items-center border border-bd transition-colors",
                    "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs disabled:cursor-not-allowed disabled:opacity-50",
                    tone === "default" && "bg-s2 text-tx hover:bg-bd",
                    tone === "muted" && "bg-sf text-mu hover:bg-s2 hover:text-tx",
                    tone === "danger" && "bg-sf text-rdt hover:bg-rdb",
                    ICON_SIZES[size], className)}
                {...rest}>
            {children}
        </button>
    );
});
