// @vitest-environment jsdom
import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "../auth/AuthContextDefinition";
import type {MySubmission} from "../api/moderation";
import MySubmissionsPage from "./MySubmissionsPage";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key, i18n: {language: "ru", changeLanguage: vi.fn()}}),
}));
const list = vi.fn();
const counts = vi.fn();
const detail = vi.fn();
vi.mock("../api/moderation", () => ({
    getMySubmissions: (...a: unknown[]) => list(...a),
    getMySubmissionCounts: () => counts(),
    getMySubmission: (id: string) => detail(id),
}));

const ROW: MySubmission = {
    id: "s1", number: 1048, formId: "f1", formTitle: "Набор в Weazel News", formSlug: "weazel", guildId: "1",
    guildName: "Vinewood Life", guildIconUrl: null, status: "NEEDS_REVISION", moderatorComment: "Добавьте ссылку",
    moderatorName: "Lena Hart", createdAt: "2026-10-12T19:40:00", decidedAt: "2026-10-13T10:00:00",
};

function show() {
    render(
        <AuthContext.Provider value={{
            user: {id: "1", discordUsername: "dmitry", avatarUrl: null, role: "", guildIds: [], permissions: [], permissionsHash: "h"},
            loading: false, login: async () => {}, logout: () => {}, banData: null,
        }}>
            <MemoryRouter><MySubmissionsPage/></MemoryRouter>
        </AuthContext.Provider>,
    );
}

describe("my submissions", () => {
    afterEach(() => {
        cleanup();
        list.mockReset();
        counts.mockReset();
        detail.mockReset();
    });

    it("lists submissions with segment counters and opens one in the side panel", async () => {
        counts.mockResolvedValue({all: 6, pending: 2, decided: 4});
        list.mockResolvedValue({content: [ROW], page: {number: 0, totalPages: 1, totalElements: 1, size: 20}});
        detail.mockResolvedValue({
            submission: ROW,
            schema: {title: "", description: "", fields: [
                {id: "name", type: "TEXT", label: "Имя персонажа", required: true},
                {id: "works", type: "URL", label: "Пример работ", required: false},
            ]},
            answers: {name: "Dmitry Volkov"},
            files: [],
        });
        const user = userEvent.setup();
        show();

        const segments = await screen.findByRole("radiogroup", {name: "mySubmissions.segmentsLabel"});
        expect(within(segments).getByRole("radio", {name: /mySubmissions.segment.pending\s*2/})).toBeTruthy();
        await user.click(within(segments).getByRole("radio", {name: /decided/}));
        expect(list).toHaveBeenLastCalledWith(0, 20, "decided");

        await user.click((await screen.findAllByRole("button", {name: "Набор в Weazel News"}))[0]);
        const panel = await screen.findByRole("dialog");
        expect(within(panel).getByText("Добавьте ссылку")).toBeTruthy();
        expect(within(panel).getByText(/Lena Hart/)).toBeTruthy();
        expect(await within(panel).findByText("Dmitry Volkov")).toBeTruthy();
        expect(within(panel).getByText("mySubmissions.notFilled")).toBeTruthy();
    });

    it("explains where links come from when there is nothing yet", async () => {
        counts.mockResolvedValue({all: 0, pending: 0, decided: 0});
        list.mockResolvedValue({content: [], page: {number: 0, totalPages: 0, totalElements: 0, size: 20}});
        show();
        expect(await screen.findByText("mySubmissions.emptyTitle")).toBeTruthy();
        expect(screen.getByRole("link", {name: "mySubmissions.openByLink"}).getAttribute("href")).toBe("/");
        expect(screen.queryByRole("radiogroup")).toBeNull();
    });
});
