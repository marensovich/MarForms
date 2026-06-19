import { useEffect, useMemo, useState } from "react";
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

function userFromToken(token: string): AuthUser | null {
  const payload = decodeToken<JwtPayload>(token);
  if (!payload || isTokenExpired(payload)) return null;

  return {
    id: String(payload.userId ?? payload.sub),
    username: "",
    avatarUrl: null,
    role: payload.role ?? "USER",
    guildIds: payload.guildIds ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const initialUser = token ? userFromToken(token) : null;

    // запускаем оба setState вне синхронного "хвоста" эффекта,
    // через микротаску — гасит предупреждение react-hooks/set-state-in-effect
    queueMicrotask(() => {
      setUser(initialUser);
      setLoading(false);
    });
  }, []);

  const login = (token: string) => {
    persistToken(token);
    setUser(userFromToken(token));
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}