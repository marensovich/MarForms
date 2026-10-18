// @vitest-environment jsdom
import {cleanup, render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ToastProvider} from "../../ui";
import UsersTab from "./UsersTab";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
vi.mock("../../hooks/useAuth", () => ({useAuth: () => ({user: {permissions: ["USERS_MODERATE", "ROLES_MANAGE"]}})}));
vi.mock("../../api/client", () => ({ApiError: class extends Error {
    status = 500;
}}));
vi.mock("../../api/dashboard", () => ({
    getRoles: () => Promise.resolve([{id: "r-mod", name: "Moderator", color: "#2563EB", permissions: ["USERS_MODERATE", "DASHBOARD_ACCESS"]}]),
}));
const api = {
    getPlatformUsers: vi.fn(),
    getUserStats: vi.fn(),
    getRestrictions: vi.fn(),
    assignUserRoles: vi.fn(),
    banUser: vi.fn(),
    unbanUser: vi.fn(),
    timeoutUser: vi.fn(),
    liftTimeout: vi.fn(),
};
vi.mock("../../api/users", () => ({
    getPlatformUsers: (...a: unknown[]) => api.getPlatformUsers(...a),
    getUserStats: () => api.getUserStats(),
    getRestrictions: (id: string) => api.getRestrictions(id),
    assignUserRoles: (...a: unknown[]) => api.assignUserRoles(...a),
    banUser: (...a: unknown[]) => api.banUser(...a),
    unbanUser: (id: string) => api.unbanUser(id),
    timeoutUser: (...a: unknown[]) => api.timeoutUser(...a),
    liftTimeout: (id: string) => api.liftTimeout(id),
}));

const base = {avatarUrl: null, until: null, reason: null, lastSeenAt: null, outranked: false, self: false};
const maria = {...base, discordId: "193004811276540928", username: "maria_sh", roles: [{id: "r-adm", name: "Admin", color: "#7C3AED"}], status: "ACTIVE", outranked: true};
const vlad = {...base, discordId: "590112874001338712", username: "vlad.kozlov", roles: [], status: "ACTIVE"};
const ghost = {...base, discordId: "902117336458820133", username: "ghost_rider", roles: [], status: "BANNED", reason: "Оскорбления"};

describe("platform users", () => {
    beforeEach(() => {
        api.getPlatformUsers.mockResolvedValue({content: [maria, vlad, ghost], page: {totalElements: 3, totalPages: 1}});
        api.getUserStats.mockResolvedValue({total: 24816, lastWeek: 612, active30: 9340, banned: 41, timedOut: 16});
        for (const f of [api.banUser, api.timeoutUser, api.unbanUser]) f.mockResolvedValue(vlad);
        api.getRestrictions.mockResolvedValue([{type: "BAN", reason: "Оскорбления в заявках", endsAt: null, createdAt: "2026-09-02T10:00:00",
            createdBy: "1", createdByName: "Кирилл Н.", liftedAt: null, liftedByName: null}]);
    });
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("locks actions on a higher role, times out with a reason, bans and unbans with the history", async () => {
        const user = userEvent.setup();
        render(<ToastProvider><UsersTab/></ToastProvider>);

        const mariaRow = (await screen.findByText("maria_sh")).closest("tr")!;
        const locked = within(mariaRow).getByRole("button", {name: "adminUsers.ban"});
        expect(locked.getAttribute("aria-disabled")).toBe("true");
        expect(document.getElementById(locked.getAttribute("aria-describedby")!)!.textContent).toBe("adminUsers.hierarchy");
        await user.click(locked);
        expect(api.banUser).not.toHaveBeenCalled();

        const vladRow = screen.getByText("vlad.kozlov").closest("tr")!;
        await user.click(within(vladRow).getByRole("button", {name: "adminUsers.timeout"}));
        const dialog = screen.getByRole("dialog");
        const give = within(dialog).getByRole("button", {name: "adminUsers.giveTimeout"}) as HTMLButtonElement;
        expect(give.disabled).toBe(true);
        await user.click(within(dialog).getByRole("button", {name: "adminUsers.preset.day:1"}));
        await user.type(within(dialog).getByRole("textbox"), "Спам");
        await user.click(give);
        expect(api.timeoutUser).toHaveBeenCalledWith("590112874001338712", 1440, "Спам");
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

        await user.click(within((await screen.findByText("vlad.kozlov")).closest("tr")!).getByRole("button", {name: "adminUsers.ban"}));
        const ban = screen.getByRole("alertdialog");
        await user.type(within(ban).getByRole("textbox"), "Читы");
        await user.click(within(ban).getByRole("button", {name: "adminUsers.ban"}));
        expect(api.banUser).toHaveBeenCalledWith("590112874001338712", "Читы");

        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        const ghostRow = (await screen.findByText("ghost_rider")).closest("tr")!;
        await user.click(within(ghostRow).getByRole("button", {name: "adminUsers.unban"}));
        const unban = screen.getByRole("alertdialog");
        expect(await within(unban).findByText(/Кирилл Н\.,Оскорбления в заявках/)).toBeTruthy();
        await user.click(within(unban).getByRole("button", {name: "adminUsers.unban"}));
        expect(api.unbanUser).toHaveBeenCalledWith("902117336458820133");
    });
});
