// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "../auth/AuthContextDefinition";
import type {AuthUser} from "../types/auth";
import AdminRoute from "./AdminRoute";
import {platformLevelKey, visibleAdminNav} from "./navigation";
import Sidebar from "./Sidebar";

// SettingsTab (behind AdminRoute) initialises the real i18n with an HTTP backend; without
// this mock useTranslation suspends and nothing renders.
vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key, i18n: {language: "ru", changeLanguage: () => Promise.resolve()}}),
    initReactI18next: {type: "3rdParty", init: () => {}},
}));

afterEach(cleanup);

const user = (permissions: string[]): AuthUser => ({
    id: "284019574330621952", discordUsername: "kirill_nv", avatarUrl: null, role: "USER",
    guildIds: [], permissions, permissionsHash: "x",
});

const ALL = ["DASHBOARD_ACCESS", "FORMS_MANAGE", "RESPONSES_MANAGE", "USERS_MODERATE", "ROLES_MANAGE", "SYSTEM_ADMIN"];

function withAuth(u: AuthUser, ui: React.ReactNode, path = "/dashboard/servers") {
    return render(
        <AuthContext.Provider value={{user: u, loading: false, login: async () => {}, logout: () => {}, banData: null}}>
            <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </AuthContext.Provider>,
    );
}

describe("navigation rules", () => {
    it("staff without permissions get no admin items", () => {
        expect(visibleAdminNav(user(["DASHBOARD_ACCESS"]))).toEqual([]);
        expect(visibleAdminNav(user([]))).toEqual([]);
    });

    it("a permission without DASHBOARD_ACCESS does not open the admin section", () => {
        expect(visibleAdminNav(user(["FORMS_MANAGE"]))).toEqual([]);
        expect(visibleAdminNav(user(["DASHBOARD_ACCESS", "FORMS_MANAGE"])).map(i => i.id)).toEqual(["forms"]);
    });

    it("platform level badge follows the strongest permission", () => {
        expect(platformLevelKey(user(ALL))).toBe("adminLevel.systemAdmin");
        expect(platformLevelKey(user(["DASHBOARD_ACCESS", "ROLES_MANAGE"]))).toBe("adminLevel.admin");
        expect(platformLevelKey(user(["DASHBOARD_ACCESS", "USERS_MODERATE"]))).toBe("adminLevel.moderator");
        expect(platformLevelKey(user(["DASHBOARD_ACCESS"]))).toBe("adminLevel.staff");
        expect(platformLevelKey(user([]))).toBeNull();
    });
});

describe("Sidebar", () => {
    it("staff without permissions sees only the servers and feedback items", () => {
        withAuth(user(["DASHBOARD_ACCESS"]), <Sidebar collapsed={false} onToggle={() => {}}/>);
        expect(screen.getAllByRole("link").map(a => a.getAttribute("href"))).toEqual(["/dashboard/servers", "/dashboard/servers", "/feedback"]);
        expect(screen.queryByText("shell.admin")).toBeNull();
    });

    it("a system admin sees all seven admin sections, the active one marked", () => {
        withAuth(user(ALL), <Sidebar collapsed={false} onToggle={() => {}}/>, "/admin/users");
        const hrefs = screen.getAllByRole("link").map(a => a.getAttribute("href"));
        expect(hrefs.filter(h => h?.startsWith("/admin/"))).toHaveLength(7);
        expect(screen.getByRole("link", {name: /nav.users/}).getAttribute("aria-current")).toBe("page");
    });

    it("collapsed items keep their names for screen readers", () => {
        withAuth(user(ALL), <Sidebar collapsed onToggle={() => {}}/>);
        expect(screen.getByRole("link", {name: "nav.settings"})).toBeTruthy();
    });
});

describe("AdminRoute", () => {
    it("shows 403 instead of an empty page without the permission", () => {
        withAuth(user(["DASHBOARD_ACCESS"]),
            <Routes><Route path="/admin/:section" element={<AdminRoute/>}/></Routes>, "/admin/settings");
        expect(screen.getByRole("alert").textContent).toContain("403");
    });
});
