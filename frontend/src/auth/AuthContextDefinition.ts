import {createContext} from "react";
import type {AuthUser} from "../types/auth";
import type {BannedError} from "../api/client";

export interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    login: (token: string) => Promise<void>; // теперь async
    logout: () => void;
    banData: BannedError | null;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
    undefined
);