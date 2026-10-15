// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes, useLocation} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "../../auth/AuthContextDefinition";
import AccessScreen from "./AccessScreen";
import {ACCESS_SCREENS, type AccessScreenCode, technicalCode} from "./accessConfig";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, vars?: Record<string, string>) => vars ? `${key}|${Object.values(vars).filter(Boolean).join(",")}` : key,
        i18n: {language: "ru"},
    }),
}));
const login = vi.fn();
vi.mock("../../api/auth", () => ({loginWithDiscord: () => login()}));

afterEach(() => {
    cleanup();
    login.mockReset();
});

const FORM = {slug: "lspd", title: "Набор в LSPD", guildName: "Los Santos RP", guildIconUrl: null};

function Where() {
    const l = useLocation();
    return <span data-testid="where">{l.pathname + l.search}</span>;
}

function show(ui: React.ReactNode, logout = vi.fn()) {
    render(
        <AuthContext.Provider value={{user: null, loading: false, login: async () => {}, logout, banData: null}}>
            <MemoryRouter initialEntries={["/f/lspd"]}>
                <Routes><Route path="*" element={<><Where/>{ui}</>}/></Routes>
            </MemoryRouter>
        </AuthContext.Provider>,
    );
    return logout;
}

describe("AccessScreen", () => {
    it("has a screen for every refusal code of the spec", () => {
        const codes: AccessScreenCode[] = ["AUTH_REQUIRED", "NOT_GUILD_MEMBER", "GUILD_BANNED", "ROLE_REQUIRED", "ROLE_DENIED",
            "ROLE_CHECK_FAILED", "NOT_OPEN_YET", "FORM_CLOSED", "FORM_ARCHIVED", "FORM_NOT_FOUND", "ERROR",
            "ACCOUNT_RESTRICTED", "LIMIT_REACHED"];
        expect(Object.keys(ACCESS_SCREENS).sort()).toEqual([...codes].sort());
        for (const code of codes) {
            show(<AccessScreen code={code} form={FORM}/>);
            expect(screen.getByRole("heading", {level: 1}).textContent).toBe(`accessScreen.${code}.title`);
            expect(screen.getByText(technicalCode(code))).toBeTruthy();
            cleanup();
        }
    });

    it("login saves the way back and starts Discord sign-in", async () => {
        const user = userEvent.setup();
        show(<AccessScreen code="AUTH_REQUIRED" form={FORM}/>);
        expect(screen.getByText("Los Santos RP · Набор в LSPD")).toBeTruthy();
        await user.click(screen.getByRole("button", {name: /accessScreen.actions.login/}));
        expect(login).toHaveBeenCalledOnce();
        expect(sessionStorage.getItem("marforms_redirect_after_login")).toBe("/f/lspd");
    });

    it("missing role lists the roles and re-checks them", async () => {
        const user = userEvent.setup();
        const onRetry = vi.fn();
        show(<AccessScreen code="ROLE_REQUIRED" form={FORM} onRetry={onRetry}
                           details={{roles: [{id: "1", name: "Гражданин", color: 0x22c55e}, {id: "2", name: null, color: 0}]}}/>);
        expect(screen.getByText("Гражданин")).toBeTruthy();
        expect(screen.getByText("2")).toBeTruthy();
        await user.click(screen.getByRole("button", {name: "accessScreen.actions.checkRoles"}));
        expect(onRetry).toHaveBeenCalledOnce();
    });

    it("a server ban shows the reason, the end and where to appeal", () => {
        show(<AccessScreen code="GUILD_BANNED" form={FORM}
                           details={{reason: "Нарушение правил NonRP", appealsContact: "discord.gg/appeals"}}/>);
        expect(screen.getByText("Нарушение правил NonRP")).toBeTruthy();
        expect(screen.getByText("accessScreen.permanent")).toBeTruthy();
        expect(screen.getByText("discord.gg/appeals")).toBeTruthy();
        expect(screen.getByText(/accessScreen.GUILD_BANNED.text\|Los Santos RP/)).toBeTruthy();
    });

    it("the limit screen opens the previous submission", async () => {
        const user = userEvent.setup();
        show(<AccessScreen code="LIMIT_REACHED" form={FORM} details={{previousSubmissionId: "abc"}}/>);
        await user.click(screen.getByRole("button", {name: "accessScreen.actions.previousSubmission"}));
        expect(screen.getByTestId("where").textContent).toBe("/me/submissions?submission=abc");
    });

    it("a restricted account can only sign out, with the platform's text", async () => {
        const user = userEvent.setup();
        const logout = show(<AccessScreen code="ACCOUNT_RESTRICTED" restrictionMessage="Мультиаккаунты запрещены"/>);
        expect(screen.getByText("Мультиаккаунты запрещены")).toBeTruthy();
        expect(screen.queryByText(/Los Santos RP/)).toBeNull();
        await user.click(screen.getByRole("button", {name: "accessScreen.actions.logout"}));
        expect(logout).toHaveBeenCalledOnce();
    });

    it("errors show the status and the request id", () => {
        expect(technicalCode("ERROR", {status: 502, correlationId: "7f3a91c2-0000"})).toBe("ERR 502 · req 7f3a91c2");
        expect(technicalCode("ERROR")).toBe("ERR");
        expect(technicalCode("FORM_CLOSED")).toBe("FORM_CLOSED");
    });
});

const remind = vi.fn();
vi.mock("../../api/forms", () => ({remindWhenOpen: (slug: string) => remind(slug)}));

describe("remind me when the form opens (#121)", () => {
    afterEach(() => remind.mockReset());

    it("subscribes a signed-in user and says it will remind", async () => {
        remind.mockResolvedValue(undefined);
        const user = userEvent.setup();
        render(
            <AuthContext.Provider value={{
                user: {id: "1", discordUsername: "d", avatarUrl: null, role: "", guildIds: [], permissions: [], permissionsHash: "h"},
                loading: false, login: async () => {}, logout: () => {}, banData: null,
            }}>
                <MemoryRouter><AccessScreen code="NOT_OPEN_YET" form={FORM} details={{opensAt: "2026-10-20T18:00:00"}}/></MemoryRouter>
            </AuthContext.Provider>,
        );
        await user.click(screen.getByRole("button", {name: "accessScreen.actions.remind"}));
        expect(remind).toHaveBeenCalledWith("lspd");
        expect(await screen.findByRole("button", {name: "accessScreen.actions.reminded"})).toHaveProperty("disabled", true);
    });

    it("asks a visitor to sign in first", async () => {
        const user = userEvent.setup();
        show(<AccessScreen code="NOT_OPEN_YET" form={FORM} details={{opensAt: "2026-10-20T18:00:00"}}/>);
        await user.click(screen.getByRole("button", {name: "accessScreen.actions.remind"}));
        expect(login).toHaveBeenCalled();
        expect(remind).not.toHaveBeenCalled();
    });

    it("shows a reminder already set", () => {
        show(<AccessScreen code="NOT_OPEN_YET" form={FORM} reminderSet/>);
        expect(screen.getByRole("button", {name: "accessScreen.actions.reminded"})).toHaveProperty("disabled", true);
    });
});
