// @vitest-environment jsdom
import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import {ToastProvider} from "../../ui";
import FormsTab from "./FormsTab";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
const api = vi.fn();
vi.mock("../../api/client", () => ({
    apiRequest: (path: string, init?: unknown) => api(path, init),
    downloadFile: vi.fn(() => Promise.resolve()),
    ApiError: class extends Error {
        status = 500;
    },
}));
vi.mock("../../api/dashboard", () => ({getGuildConnectUrl: vi.fn(), publishGuildForm: vi.fn(), setGuildFormStatus: vi.fn()}));

const row = (id: string, title: string, slug: string, status: string, count: number) => ({
    form: {id, title, slug, status, active: status === "PUBLISHED", submissionCount: count, createdAt: "2026-10-01T00:00:00", serverId: "8101"},
    guildName: "Los Santos RP", guildIconUrl: null,
});

describe("platform forms", () => {
    afterEach(() => {
        cleanup();
        api.mockReset();
    });

    it("pages on the server, filters by status and deletes a form only after its slug is typed", async () => {
        api.mockImplementation((path: string) => {
            if (path.startsWith("/admin/forms/stats")) return Promise.resolve({total: 3, active: 2, submissions: 1284});
            if (path.startsWith("/admin/forms/servers")) return Promise.resolve([{guildId: "8101", name: "Los Santos RP", iconUrl: null, botStatus: "CONNECTED", forms: 3}]);
            if (path.startsWith("/admin/forms/bulk")) return Promise.resolve({done: 1});
            return Promise.resolve({content: [row("a", "Набор в LSPD", "lspd-academy", "PUBLISHED", 1284)], page: {totalElements: 1, totalPages: 1}});
        });
        const user = userEvent.setup();
        render(<ToastProvider><MemoryRouter><FormsTab/></MemoryRouter></ToastProvider>);

        expect(await screen.findByText("Набор в LSPD")).toBeTruthy();
        expect(screen.getAllByText("1 284").length).toBe(2); // the KPI and the row
        expect(api).toHaveBeenCalledWith(expect.stringContaining("status=all&sort=createdAt%2Cdesc&page=0&size=25"), undefined);

        await user.click(screen.getByRole("radio", {name: /adminForms.segment.active/}));
        expect(api).toHaveBeenLastCalledWith(expect.stringContaining("status=active"), undefined);

        await user.click(screen.getByRole("button", {name: "common.delete"}));
        const dialog = screen.getByRole("alertdialog");
        const confirm = within(dialog).getByRole("button", {name: "common.delete"});
        expect((confirm as HTMLButtonElement).disabled).toBe(true);
        await user.type(within(dialog).getByRole("textbox"), "lspd-academy");
        await user.click(confirm);
        expect(api).toHaveBeenCalledWith("/admin/forms/bulk", {method: "POST", body: {ids: ["a"], action: "DELETE"}});
    });
});
