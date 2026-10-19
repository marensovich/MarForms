import type {ReactNode} from "react";
import {useCallback, useEffect, useMemo, useState} from "react";
import {useLocation} from "react-router-dom";
import type {AuthUser, JwtPayload} from "../types/auth";
import {clearToken, decodeToken, getToken, isTokenExpired, setToken as persistToken,} from "./token";
import {AuthContext} from "./AuthContextDefinition";
import {fetchMe} from "../api/me";
import {logoutEverywhere} from "../api/auth";
import {ApiError, BanError, type BannedError} from "../api/client.ts";

function isTokenValid(token: string): boolean {
    const payload = decodeToken<JwtPayload>(token);
    return payload !== null && !isTokenExpired(payload);
}

function stubUserFromToken(token: string): AuthUser | null {
    const payload = decodeToken<JwtPayload>(token);
    if (!payload || isTokenExpired(payload)) return null;

    return {
        id: String(payload.userId ?? payload.sub ?? ""),
        discordUsername: "",
        avatarUrl: null,
        role: payload.role ?? "VIEWER",
        guildIds: payload.guildIds ?? [],
        permissions: [],
        permissionsHash: "",
    };
}

export function AuthProvider({children}: { children: ReactNode }) {
    // The saved token is read before the first render: the stub user shows at
    // once, and there is nothing to load without a valid token.
    const [user, setUser] = useState<AuthUser | null>(() => {
        const token = getToken();
        return token && isTokenValid(token) ? stubUserFromToken(token) : null;
    });
    const [loading, setLoading] = useState(() => {
        const token = getToken();
        return !!token && isTokenValid(token);
    });
    const [banData, setBanData] = useState<BannedError | null>(null);
    const location = useLocation();

    const loadMe = useCallback(async () => {
        try {
            const me = await fetchMe();

            setUser(prev => {
                if (!prev) return null;

                if (prev.permissionsHash !== "" && prev.permissionsHash !== me.permissionsHash) {
                    clearToken();
                    return null;
                }

                return {
                    ...prev,
                    discordUsername: me.discordUsername,
                    permissions: me.permissions,
                    permissionsHash: me.permissionsHash,
                    timeout: me.timeout ?? null,
                };
            });
        } catch (err) {
            if (err instanceof BanError) {
                clearToken();
                setUser(null);
                setBanData(err.data);
                return;
            }
            // Only a rejected token ends the session. A network error or a
            // backend restart (5xx) must not throw everyone out mid-edit (#103);
            // the next poll tries again.
            if (err instanceof ApiError && err.status === 401) {
                clearToken();
                setUser(null);
            }
        }
    }, []);

    useEffect(() => {
        const token = getToken();

        if (!token || !isTokenValid(token)) {
            clearToken();
            return;
        }

        // loadMe sets state only after the request answers, never during the effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- async: the first setState is past an await
        loadMe().finally(() => setLoading(false));
    }, [loadMe]);

    useEffect(() => {
        if (!user) return;
        // Not while filling in a form: a public form never needs it.
        if (/^\/(forms|f)\//.test(location.pathname)) return;

        const interval = setInterval(() => {
            loadMe();
        }, 30_000);

        return () => clearInterval(interval);
    }, [user, loadMe, location.pathname]);

    const login = useCallback(
        async (token: string) => {
            persistToken(token);
            const stub = stubUserFromToken(token);
            setUser(stub);
            await loadMe();
        },
        [loadMe]
    );

    const logout = useCallback(() => {
        // Revoke server-side too, so a copied token stops working; sign out locally either way.
        logoutEverywhere().catch(() => undefined).finally(() => {
            clearToken();
            setUser(null);
        });
    }, []);

    const value = useMemo(
        () => ({user, loading, login, logout, banData}),
        [user, loading, login, logout, banData]
    );
    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}