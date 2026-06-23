import type {ReactNode} from "react";
import {useCallback, useEffect, useMemo, useState} from "react";
import type {AuthUser, JwtPayload} from "../types/auth";
import {clearToken, decodeToken, getToken, isTokenExpired, setToken as persistToken,} from "./token";
import {AuthContext} from "./AuthContextDefinition";
import {fetchMe} from "../api/me";
import {BanError, type BannedError} from "../api/client.ts";

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
        permissionsHash: 0,
    };
}

export function AuthProvider({children}: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [banData, setBanData] = useState<BannedError | null>(null);

    const loadMe = useCallback(async () => {
        try {
            const me = await fetchMe();

            setUser(prev => {
                if (!prev) return null;

                if (prev.permissionsHash !== 0 && prev.permissionsHash !== me.permissionsHash) {
                    clearToken();
                    return null;
                }

                return {
                    ...prev,
                    discordUsername: me.discordUsername,
                    permissions: me.permissions,
                    permissionsHash: me.permissionsHash,
                };
            });
        } catch (err) {
            if (err instanceof BanError) {
                clearToken();
                setUser(null);
                setBanData(err.data);
                return;
            }
            clearToken();
            setUser(null);
        }
    }, []);

    useEffect(() => {
        const token = getToken();

        if (!token || !isTokenValid(token)) {
            clearToken();
            setLoading(false);
            return;
        }

        const stub = stubUserFromToken(token);
        setUser(stub);

        loadMe().finally(() => setLoading(false));
    }, [loadMe]);

    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            loadMe();
        }, 30_000);

        return () => clearInterval(interval);
    }, [user, loadMe]);

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
        clearToken();
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({user, loading, login, logout, banData}),
        [user, loading, login, logout, banData]
    );
    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}