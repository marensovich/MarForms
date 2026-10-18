// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes, useLocation} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {MyGuild} from "../api/dashboard";
import CommandPalette from "./CommandPalette";
import {formTarget, newFormTarget, queueTarget, submissionTarget} from "./commands";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key, i18n: {language: "ru"}}),
}));

const searchMock = vi.fn();
vi.mock("../api/search", () => ({search: (...args: unknown[]) => searchMock(...args)}));

afterEach(() => {
    cleanup();
    searchMock.mockReset();
});

const GUILD = {guildId: "7101", guildName: "Los Santos RP", role: "OWNER"} as MyGuild;

function Where() {
    const location = useLocation();
    return <span data-testid="where">{location.pathname + location.search}</span>;
}

function setup(onClose = vi.fn()) {
    render(
        <MemoryRouter initialEntries={["/dashboard/servers"]}>
            <Routes><Route path="*" element={<><Where/><CommandPalette open onClose={onClose} guilds={[GUILD]}/></>}/></Routes>
        </MemoryRouter>,
    );
    return onClose;
}

describe("CommandPalette", () => {
    it("searches after two characters and opens the chosen hit with the keyboard", async () => {
        const user = userEvent.setup();
        searchMock.mockResolvedValue({
            forms: [{id: "f1", title: "Набор в LSPD", slug: "lspd", status: "PUBLISHED", guildId: "7101", guildName: "Los Santos RP", workspace: true}],
            submissions: [],
            users: [],
        });
        const onClose = setup();
        expect(screen.getByRole("combobox")).toBe(document.activeElement);
        await user.keyboard("l");
        expect(searchMock).not.toHaveBeenCalled();
        await user.keyboard("spd");
        expect(await screen.findByText("palette.forms")).toBeTruthy();
        expect(searchMock).toHaveBeenLastCalledWith("lspd", expect.any(AbortSignal));
        await user.keyboard("{Enter}");
        expect(onClose).toHaveBeenCalled();
        expect(screen.getByTestId("where").textContent).toBe("/dashboard/servers/7101/forms");
    });

    it("lists the actions and runs one with arrows and Enter", async () => {
        const user = userEvent.setup();
        setup();
        expect(screen.getByText("palette.newForm")).toBeTruthy();
        await user.keyboard("{ArrowDown}{Enter}");
        expect(screen.getByTestId("where").textContent).toBe("/dashboard/servers/7101/submissions");
    });

    it("Escape closes it", async () => {
        const user = userEvent.setup();
        const onClose = setup();
        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledOnce();
    });
});

describe("palette targets", () => {
    it("workspace hits open in the server, others in the admin section", () => {
        const form = {id: "f", title: "LSPD", slug: "lspd", status: "PUBLISHED" as const, guildId: "1", guildName: null};
        expect(formTarget({...form, workspace: true})).toBe("/dashboard/servers/1/forms");
        expect(formTarget({...form, workspace: false})).toBe("/admin/forms?search=lspd");
        const sub = {id: "s", formId: "f", formTitle: null, guildId: "1", guildName: null, authorDiscordId: "2",
            authorName: "a", status: "PENDING" as const, createdAt: ""};
        expect(submissionTarget({...sub, workspace: true})).toBe("/dashboard/servers/1/submissions?submission=s");
        expect(submissionTarget({...sub, workspace: false})).toBe("/admin/submissions?submission=s");
    });

    it("actions go straight to the only server, else to the server list", () => {
        expect(newFormTarget([GUILD])).toBe("/dashboard/servers/7101/forms/new");
        expect(newFormTarget([GUILD, {...GUILD, guildId: "2"}])).toBe("/dashboard/servers");
        expect(queueTarget(null)).toBe("/dashboard/servers");
    });
});
