// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "../auth/AuthContextDefinition";
import type {AuthUser} from "../types/auth";
import AuthCallback from "./AuthCallback";
import LoginPage from "./LoginPage";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key, i18n: {language: "ru", changeLanguage: vi.fn()}}),
}));
vi.mock("../api/settings", () => ({fetchPublicSettings: () => Promise.resolve({systemName: "MarForms"})}));
const exchange = vi.fn();
vi.mock("../api/auth", () => ({exchangeLoginCode: (code: string) => exchange(code), loginWithDiscord: vi.fn()}));

function show(path: string, user: AuthUser | null = null, login = vi.fn().mockResolvedValue(undefined)) {
    render(
        <AuthContext.Provider value={{user, loading: false, login, logout: () => {}, banData: null}}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/login" element={<LoginPage/>}/>
                    <Route path="/auth" element={<AuthCallback/>}/>
                    <Route path="/home" element={<span>home</span>}/>
                    <Route path="/f/:slug" element={<span>form</span>}/>
                </Routes>
            </MemoryRouter>
        </AuthContext.Provider>,
    );
    return login;
}

describe("sign-in", () => {
    afterEach(() => {
        cleanup();
        exchange.mockReset();
        sessionStorage.clear();
    });

    it("lists what is asked of Discord and sends a signed-in user home", () => {
        show("/login");
        expect(screen.getByRole("button", {name: "login.continueDiscord"})).toBeTruthy();
        expect(screen.getByText("identify")).toBeTruthy();
        expect(screen.getByText("guilds")).toBeTruthy();
        cleanup();
        show("/login", {id: "1", discordUsername: "d", avatarUrl: null, role: "", guildIds: [], permissions: [], permissionsHash: "h"});
        expect(screen.getByText("home")).toBeTruthy();
    });

    it("shows Discord's refusal with its reference and a retry", () => {
        show("/auth?error=access_denied&ref=7f3a91c2");
        expect(screen.getByRole("alert").textContent).toContain("auth.errors.access_denied");
        expect(screen.getByText("error=access_denied · ref 7f3a91c2")).toBeTruthy();
        expect(screen.getByRole("button", {name: "auth.retry"})).toBeTruthy();
        expect(exchange).not.toHaveBeenCalled();
    });

    it("returns to the page the sign-in started from", async () => {
        sessionStorage.setItem("marforms_redirect_after_login", "/f/lspd");
        exchange.mockResolvedValue("token");
        const login = show("/auth?code=abc");
        expect(screen.getByRole("status").textContent).toContain("auth.signingIn");
        expect(await screen.findByText("form")).toBeTruthy();
        expect(login).toHaveBeenCalledWith("token");
    });

    it("explains an expired code", async () => {
        exchange.mockRejectedValue(new Error("410"));
        show("/auth?code=old");
        expect((await screen.findByRole("alert")).textContent).toContain("auth.errors.code_expired");
    });
});
