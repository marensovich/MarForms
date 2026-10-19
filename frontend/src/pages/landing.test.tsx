// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes, useLocation} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "../auth/AuthContextDefinition";
import type {AuthUser} from "../types/auth";
import {hasPanel} from "../auth/useHomePath";
import LandingPage from "./LandingPage";
import {parseFormLink} from "./landingLink";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key, i18n: {language: "ru", changeLanguage: vi.fn()}}),
}));
const guilds = vi.fn();
vi.mock("../api/dashboard", () => ({getMyGuilds: () => guilds()}));

const USER: AuthUser = {
    id: "1", discordUsername: "dmitry", avatarUrl: null, role: "USER", guildIds: [],
    permissions: [], permissionsHash: "h",
};

function Where() {
    return <span data-testid="where">{useLocation().pathname}</span>;
}

function show(user: AuthUser | null) {
    return render(
        <AuthContext.Provider value={{user, loading: false, login: async () => {}, logout: () => {}, banData: null}}>
            <MemoryRouter initialEntries={["/"]}>
                <Routes>
                    <Route path="/" element={<LandingPage/>}/>
                    <Route path="*" element={<Where/>}/>
                </Routes>
            </MemoryRouter>
        </AuthContext.Provider>,
    );
}

describe("landing", () => {
    afterEach(() => {
        cleanup();
        guilds.mockReset();
    });

    it("offers sign-in to a visitor", () => {
        show(null);
        expect(screen.getAllByRole("link", {name: "landing.signIn"})[0].getAttribute("href")).toBe("/login");
        expect(screen.queryByRole("link", {name: "landing.panel"})).toBeNull();
        // Feedback from the start page too, header and footer (phones have only the footer).
        const feedback = screen.getAllByRole("link", {name: "landing.nav.feedback"});
        expect(feedback).toHaveLength(2);
        expect(feedback[0].getAttribute("href")).toBe("/feedback?from=%2F");
    });

    it("shows the panel to a server owner and only the user menu to a respondent", async () => {
        guilds.mockResolvedValue([{guildId: "1", guildName: "LS", botStatus: "CONNECTED", role: "OWNER", since: ""}]);
        show(USER);
        expect((await screen.findAllByRole("link", {name: "landing.panel"}))[0].getAttribute("href")).toBe("/dashboard/servers");
        expect(screen.queryByRole("link", {name: "landing.signIn"})).toBeNull();
        cleanup();

        guilds.mockResolvedValue([{guildId: "1", guildName: "LS", botStatus: "CONNECTED", role: "RESPONDENT", since: ""}]);
        show(USER);
        expect(await screen.findByRole("button", {name: /dmitry/})).toBeTruthy();
        expect(screen.queryByRole("link", {name: "landing.panel"})).toBeNull();
    });

    it("opens a form by link and explains a wrong one", async () => {
        const user = userEvent.setup();
        show(null);
        const input = screen.getByLabelText("landing.openLabel");
        await user.type(input, "not a link at all");
        await user.click(screen.getByRole("button", {name: "landing.openButton"}));
        expect(screen.getByText("landing.openError")).toBeTruthy();
        await user.clear(input);
        await user.type(input, "marforms.app/f/lspd-2026");
        await user.click(screen.getByRole("button", {name: "landing.openButton"}));
        expect(screen.getByTestId("where").textContent).toBe("/f/lspd-2026");
    });
});

describe("form links and home", () => {
    it("reads links, old links and codes", () => {
        expect(parseFormLink(" lspd ")).toBe("/f/lspd");
        expect(parseFormLink("https://marforms.app/f/lspd?x=1")).toBe("/f/lspd");
        expect(parseFormLink("marforms.app/f/lspd/")).toBe("/f/lspd");
        expect(parseFormLink("http://localhost:5173/forms/abc123")).toBe("/forms/abc123");
        expect(parseFormLink("https://example.com/other/page")).toBeNull();
        expect(parseFormLink("")).toBeNull();
    });

    it("sends staff to the panel and respondents to their submissions", () => {
        expect(hasPanel({...USER, permissions: ["DASHBOARD_ACCESS"]}, [])).toBe(true);
        expect(hasPanel({...USER, permissions: ["FORMS_MANAGE"]}, [])).toBe(true);
        expect(hasPanel(USER, [{guildId: "1", guildName: "", botStatus: "CONNECTED", role: "MODERATOR", since: ""}])).toBe(true);
        expect(hasPanel(USER, [])).toBe(false);
    });
});
