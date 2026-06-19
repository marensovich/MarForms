const TOKEN_KEY = "jwt";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function decodeToken<T>(token: string): T | null {
  try {
    return JSON.parse(atob(token.split(".")[1])) as T;
  } catch {
    return null;
  }
}

export function isTokenExpired(payload: { exp: number }): boolean {
  return payload.exp * 1000 <= Date.now();
}