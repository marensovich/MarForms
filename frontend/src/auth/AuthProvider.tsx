import { useEffect, useMemo, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { AuthUser, JwtPayload } from "../types/auth";
import {
  getToken,
  setToken as persistToken,
  clearToken,
  decodeToken,
  isTokenExpired,
} from "./token";
import { AuthContext } from "./AuthContextDefinition";
import { fetchMe } from "../api/me";

function isTokenValid(token: string): boolean {
  const payload = decodeToken<JwtPayload>(token);
  return payload !== null && !isTokenExpired(payload);
}

// Минимальный user из JWT — без username/permissions (они грузятся через /me)
function stubUserFromToken(token: string): AuthUser | null {
  const payload = decodeToken<JwtPayload>(token);
  if (!payload || isTokenExpired(payload)) return null;

  return {
    id: String(payload.userId ?? payload.sub ?? ""),
    discordUsername: "",
    avatarUrl: null,
    role: payload.role ?? "USER",
    guildIds: payload.guildIds ?? [],
    permissions: [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Загружает /me и обогащает user реальными данными
  const loadMe = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser((prev) =>
        prev
          ? {
              ...prev,
              discordUsername: me.discordUsername,
              permissions: me.permissions,
            }
          : null
      );
    } catch {
      // /me вернул 401/403 — токен протух или юзер забанен
      clearToken();
      setUser(null);
    }
  }, []);

  // Инициализация при монтировании
  useEffect(() => {
    const token = getToken();

    if (!token || !isTokenValid(token)) {
      clearToken();
      setLoading(false);
      return;
    }

    const stub = stubUserFromToken(token);
    setUser(stub);

    // Загружаем реальные данные асинхронно, не блокируя рендер
    loadMe().finally(() => setLoading(false));
  }, [loadMe]);

  const login = useCallback(
    async (token: string) => {
      persistToken(token);
      const stub = stubUserFromToken(token);
      setUser(stub);
      // Сразу грузим /me — к моменту редиректа на / данные уже будут
      await loadMe();
    },
    [loadMe]
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}