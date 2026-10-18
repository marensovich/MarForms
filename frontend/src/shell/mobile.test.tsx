// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {MyGuild} from "../api/dashboard";
import {MobileNav} from "./MobileShell";
import AdminRoute from "./AdminRoute";
import {Route, Routes} from "react-router-dom";

const t = (key: string) => key;
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}}), initReactI18next: {type: "3rdParty", init: () => {}}}));
vi.mock("../hooks/useAuth", () => ({useAuth: () => ({user: {id: "1", discordUsername: "kirill", permissions: ["FORMS_MANAGE", "DASHBOARD_ACCESS"]}})}));
vi.mock("./NotificationBell", () => ({default: () => null}));

const guild = (id: string): MyGuild => ({guildId: id, guildName: `G${id}`, botStatus: "CONNECTED", role: "OWNER", since: ""});

describe("the cabinet on a phone", () => {
    beforeEach(() => {
        vi.stubGlobal("matchMedia", (q: string) => ({matches: q.includes("max-width"), addEventListener() {}, removeEventListener() {}}));
    });
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it("points «Заявки» and «Формы» at the open server", () => {
        render(<MemoryRouter initialEntries={["/dashboard/servers/7/submissions"]}>
            <MobileNav guilds={[guild("7"), guild("8")]} onMore={() => {}}/>
        </MemoryRouter>);
        expect(screen.getByRole("link", {name: "shell.mobileTabs.submissions"}).getAttribute("href")).toBe("/dashboard/servers/7/submissions");
        expect(screen.getByRole("link", {name: "shell.mobileTabs.submissions"}).getAttribute("aria-current")).toBe("page");
        expect(screen.getByRole("link", {name: "shell.mobileTabs.forms"}).getAttribute("href")).toBe("/dashboard/servers/7/forms");
    });

    it("sends the administration to a computer", () => {
        render(<MemoryRouter initialEntries={["/admin/forms"]}>
            <Routes><Route path="/admin/:section" element={<AdminRoute/>}/></Routes>
        </MemoryRouter>);
        expect(screen.getByText("shell.desktopOnly.title")).toBeTruthy();
    });
});
