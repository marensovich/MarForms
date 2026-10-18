// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import {ToastProvider} from "../../ui";
import ResponsesTab from "./ResponsesTab";

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
vi.mock("../../api/moderation", () => ({
    getSubmissionDetail: () => Promise.resolve({
        submission: {id: "s1", status: "PENDING", answers: {name: "Dmitry Volkov"}},
        formId: "f1",
        schema: {title: "Набор в LSPD", fields: [{id: "name", type: "TEXT", label: "Имя и фамилия персонажа"}]},
        author: null, files: [], history: [],
    }),
    downloadSubmissionFile: vi.fn(),
}));

const row = {
    submission: {id: "s1", formId: "f1", discordId: "412988120773", createdAt: "2026-10-15T14:02:00", status: "PENDING",
        discordUsername: "dmitry_ballas", formTitle: "Набор в LSPD"},
    guildId: "8101", guildName: "Los Santos RP", avatarUrl: null, answered: 11, fields: 12,
};
const kate = {discordId: "701122984336", username: "kate_wl", avatarUrl: null, submissions: 14, forms: 6, last: "2026-10-14T21:05:00"};

describe("platform submissions", () => {
    afterEach(() => {
        cleanup();
        api.mockReset();
    });

    it("filters, opens the panel, deletes, and shows a user's submissions from the by-user view", async () => {
        api.mockImplementation((path: string) => {
            if (path.startsWith("/admin/submissions/stats")) return Promise.resolve({total: 48912, lastWeek: 2310, forms: 318, activeForms: 204, users: 21407});
            if (path.startsWith("/admin/forms")) return Promise.resolve({content: [{form: {id: "f1", title: "Набор в LSPD"}}], page: {totalElements: 1, totalPages: 1}});
            if (path.startsWith("/admin/submissions/by-user")) return Promise.resolve({content: [kate], page: {totalElements: 1, totalPages: 1}});
            if (path.startsWith("/admin/submissions/s1")) return Promise.resolve(undefined);
            return Promise.resolve({content: [row], page: {totalElements: 1, totalPages: 1}});
        });
        const user = userEvent.setup();
        render(<ToastProvider><MemoryRouter><ResponsesTab/></MemoryRouter></ToastProvider>);

        expect(await screen.findByText("dmitry_ballas")).toBeTruthy();
        expect(screen.getByText("11/12")).toBeTruthy();
        expect(api).toHaveBeenCalledWith("/admin/submissions?page=0&size=25&sort=createdAt%2Cdesc", undefined);

        await user.selectOptions(await screen.findByRole("combobox", {name: /adminResponses.form/}), "f1");
        fireEvent.change(screen.getByLabelText("adminResponses.from"), {target: {value: "2026-10-01"}});
        expect(api).toHaveBeenLastCalledWith(expect.stringContaining("formId=f1&from=2026-10-01"), undefined);

        await user.click(await screen.findByText("dmitry_ballas"));
        const panel = screen.getByRole("complementary", {name: "adminResponses.panel"});
        expect(await within(panel).findByText("Dmitry Volkov")).toBeTruthy();
        expect(within(panel).getByRole("link", {name: "adminResponses.openQueue"}).getAttribute("href"))
            .toBe("/dashboard/servers/8101/submissions?submission=s1");

        await user.click(within(panel).getByRole("button", {name: "adminResponses.delete"}));
        await user.click(within(screen.getByRole("alertdialog")).getByRole("button", {name: "common.delete"}));
        expect(api).toHaveBeenCalledWith("/admin/submissions/s1", {method: "DELETE"});

        await user.click(screen.getByRole("radio", {name: /adminResponses.byUser/}));
        await user.click(await screen.findByRole("button", {name: /adminResponses.userSubmissions/}));
        expect(api).toHaveBeenLastCalledWith(expect.stringContaining("user=701122984336"), undefined);
        expect(api).toHaveBeenLastCalledWith(expect.stringMatching(/^\/admin\/submissions\?/), undefined);
    });
});
