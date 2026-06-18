import { useEffect, useState, useCallback } from "react";
import { getToken, setToken, clearToken, isAuthenticated } from "../utils/token";

interface UseAuthResult {
  authenticated: boolean;
  loading: boolean;
  finalizeLogin: (token: string) => void;
  logout: () => void;
}

export function useAuth(): UseAuthResult {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
    setLoading(false);
  }, []);

  const finalizeLogin = useCallback((token: string) => {
    setToken(token);
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAuthenticated(false);
  }, []);

  return { authenticated, loading, finalizeLogin, logout };
}

// Реэкспорт для мест, где не нужен весь хук (например, вне React-дерева)
export { getToken };