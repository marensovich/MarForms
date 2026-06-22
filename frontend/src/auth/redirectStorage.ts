const REDIRECT_KEY = "marforms_redirect_after_login";

export function saveRedirectPath(path: string): void {
    sessionStorage.setItem(REDIRECT_KEY, path);
}

export function consumeRedirectPath(): string | null {
    const path = sessionStorage.getItem(REDIRECT_KEY);
    sessionStorage.removeItem(REDIRECT_KEY);
    return path;
}