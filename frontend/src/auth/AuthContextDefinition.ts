import { createContext } from "react";
import type { AuthUser } from "../types/auth";

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (token: string) => Promise<void>; // теперь async
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);