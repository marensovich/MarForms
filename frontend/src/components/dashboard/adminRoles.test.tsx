// @vitest-environment jsdom
import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ToastProvider} from "../../ui";
import RolesTab from "./RolesTab";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
let permissions = ["ROLES_MANAGE"];
vi.mock("../../hooks/useAuth", () => ({useAuth: () => ({user: {permissions}})}));
const api = {getRoles: vi.fn(), updateRole: vi.fn(), createRole: vi.fn(), deleteRole: vi.fn()};
vi.mock("../../api/dashboard", () => ({
    getRoles: () => api.getRoles(),
    updateRole: (...a: unknown[]) => api.updateRole(...a),
    createRole: (...a: unknown[]) => api.createRole(...a),
    deleteRole: (id: string) => api.deleteRole(id),
}));

const ROLES = [
    {id: "sys", name: "System Admin", color: "#DC2626", permissions: ["SYSTEM_ADMIN"], system: true, users: 1},
    {id: "mod", name: "Moderator", color: "#2563EB", permissions: ["DASHBOARD_ACCESS", "RESPONSES_MANAGE"], system: false, users: 6},
    {id: "staff", name: "Staff", color: "#16A34A", permissions: ["DASHBOARD_ACCESS"], system: false, users: 14},
];

describe("platform roles", () => {
    beforeEach(() => {
        permissions = ["ROLES_MANAGE"];
        api.getRoles.mockResolvedValue(ROLES);
        api.updateRole.mockImplementation((id: string, p: { name: string; permissions: string[] }) =>
            Promise.resolve({...ROLES.find(r => r.id === id), ...p}));
        api.deleteRole.mockResolvedValue(undefined);
        api.createRole.mockResolvedValue({id: "new", name: "Поддержка", color: "#0891B2", permissions: ["DASHBOARD_ACCESS"], system: false});
    });
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("marks changes, asks before switching roles unsaved, saves, and deletes with the number of holders", async () => {
        const user = userEvent.setup();
        render(<ToastProvider><MemoryRouter><RolesTab/></MemoryRouter></ToastProvider>);

        // A roles manager can't touch the system role: read-only with the reason.
        expect(await screen.findByRole("note")).toBeTruthy();
        await user.click(screen.getByRole("button", {name: /^Moderator/}));
        expect(screen.queryByRole("note")).toBeNull();
        expect((screen.getByRole("switch", {name: "adminRoles.rootOnlyRight"}) as HTMLButtonElement).disabled).toBe(true);

        await user.click(screen.getByRole("switch", {name: "USERS_MODERATE"}));
        expect(screen.getByText("adminRoles.changed")).toBeTruthy();
        expect(screen.getByRole("region", {name: "adminRoles.unsaved"}).textContent).toContain("adminRoles.unsavedRights:1,Moderator");

        await user.click(screen.getByRole("button", {name: /^Staff/}));
        const leave = screen.getByRole("alertdialog");
        await user.click(within(leave).getByRole("button", {name: "adminRoles.stay"}));
        expect(screen.getByRole("region", {name: "adminRoles.unsaved"})).toBeTruthy();

        await user.click(screen.getByRole("button", {name: "common.save"}));
        expect(api.updateRole).toHaveBeenCalledWith("mod", expect.objectContaining({
            permissions: expect.arrayContaining(["DASHBOARD_ACCESS", "RESPONSES_MANAGE", "USERS_MODERATE"]),
        }));
        expect(screen.queryByRole("region", {name: "adminRoles.unsaved"})).toBeNull();

        await user.click(screen.getByRole("button", {name: "adminRoles.delete"}));
        const confirm = screen.getByRole("alertdialog");
        expect(confirm.textContent).toContain("adminRoles.deleteText:6");
        await user.click(within(confirm).getByRole("button", {name: "adminRoles.delete"}));
        expect(api.deleteRole).toHaveBeenCalledWith("mod");
    });

    it("creates a role with rights copied from another", async () => {
        const user = userEvent.setup();
        render(<ToastProvider><MemoryRouter><RolesTab/></MemoryRouter></ToastProvider>);
        await user.click(await screen.findByRole("button", {name: "adminRoles.create"}));
        const dialog = screen.getByRole("dialog");
        await user.type(within(dialog).getByRole("textbox"), "Поддержка");
        await user.selectOptions(within(dialog).getByRole("combobox"), "staff");
        await user.click(within(dialog).getByRole("button", {name: "adminRoles.createAction"}));
        expect(api.createRole).toHaveBeenCalledWith(expect.objectContaining({name: "Поддержка", copyFrom: "staff"}));
    });
});
