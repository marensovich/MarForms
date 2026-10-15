import type {ViewerAccess} from "../../api/forms";

// The access screens of ТЗ 3.5 (#111): tone, icon and actions per code, as drawn in
// docs/design/mockups/AccessDesktop.dc.html. Texts live in locales under accessScreen.<code>.

export type AccessScreenCode = Exclude<ViewerAccess, "GRANTED"> | "ERROR";
export type AccessTone = "primary" | "amber" | "red" | "neutral";
export type AccessIcon = "lock" | "user" | "ban" | "shield" | "x" | "refresh" | "clock" | "box" | "search" | "alert" | "check";
export type AccessAction = "login" | "checkRoles" | "retry" | "mySubmissions" | "previousSubmission" | "home" | "logout" | "otherLink";

export interface AccessScreenConfig {
    tone: AccessTone;
    icon: AccessIcon;
    primary?: AccessAction;
    secondary: AccessAction;
    /** Shows the server line above the card (the form is known). */
    server: boolean;
}

export const ACCESS_SCREENS: Record<AccessScreenCode, AccessScreenConfig> = {
    AUTH_REQUIRED: {tone: "primary", icon: "lock", primary: "login", secondary: "home", server: true},
    NOT_GUILD_MEMBER: {tone: "amber", icon: "user", primary: "retry", secondary: "mySubmissions", server: true},
    GUILD_BANNED: {tone: "red", icon: "ban", secondary: "mySubmissions", server: true},
    ROLE_REQUIRED: {tone: "amber", icon: "shield", primary: "checkRoles", secondary: "mySubmissions", server: true},
    ROLE_DENIED: {tone: "red", icon: "x", secondary: "mySubmissions", server: true},
    ROLE_CHECK_FAILED: {tone: "amber", icon: "refresh", primary: "checkRoles", secondary: "mySubmissions", server: true},
    NOT_OPEN_YET: {tone: "primary", icon: "clock", secondary: "home", server: true},
    FORM_CLOSED: {tone: "neutral", icon: "lock", secondary: "mySubmissions", server: true},
    FORM_ARCHIVED: {tone: "neutral", icon: "box", secondary: "mySubmissions", server: true},
    FORM_NOT_FOUND: {tone: "neutral", icon: "search", primary: "home", secondary: "mySubmissions", server: false},
    ERROR: {tone: "red", icon: "alert", primary: "retry", secondary: "home", server: false},
    ACCOUNT_RESTRICTED: {tone: "red", icon: "lock", secondary: "logout", server: false},
    LIMIT_REACHED: {tone: "primary", icon: "check", primary: "previousSubmission", secondary: "home", server: true},
};

/** Technical code under the card; errors show status and request id instead. */
export function technicalCode(code: AccessScreenCode, error?: { status?: number; correlationId?: string }): string {
    if (code !== "ERROR") return code;
    const parts = ["ERR", error?.status ? String(error.status) : null, error?.correlationId ? `req ${error.correlationId.slice(0, 8)}` : null];
    return parts.filter(Boolean).join(" · ").replace("ERR · ", "ERR ");
}
