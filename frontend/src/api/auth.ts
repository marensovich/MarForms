import {API, apiRequest} from "./client";

/**
 * Trades the one-time code from the OAuth redirect for a session token. The
 * HttpOnly cookie set on that redirect must go along, hence credentials.
 */
export async function exchangeLoginCode(code: string): Promise<string> {
    const {token} = await apiRequest<{ token: string }>("/auth/exchange", {
        method: "POST",
        body: {code},
        credentials: "include",
    });
    return token;
}

/** Revokes every session token of the current user on the server. */
export function logoutEverywhere(): Promise<void> {
    return apiRequest<void>("/auth/logout", {method: "POST"});
}

export function loginWithDiscord() {
    window.location.href =
        `${API}/oauth2/authorization/discord`;
}