// @vitest-environment jsdom
import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {MyGuild} from "../../../api/dashboard";
import {ToastProvider} from "../../../ui";
import ModeratorsPanel from "./ModeratorsPanel";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
const add = vi.fn();
const remove = vi.fn();
const search = vi.fn();
const setForms = vi.fn();
vi.mock("../../../api/dashboard", () => ({
    getGuildModerators: () => Promise.resolve([
        {discordId: "1", username: "kirill", role: "OWNER", since: "2026-09-01T00:00:00"},
        {discordId: "2", username: "anna", role: "MODERATOR", since: "2026-09-02T00:00:00", addedByName: "kirill"},
    ]),
    searchGuildMembers: (...a: unknown[]) => search(...a),
    addGuildModerator: (...a: unknown[]) => add(...a),
    removeGuildModerator: (...a: unknown[]) => remove(...a),
    setModeratorForms: (...a: unknown[]) => setForms(...a),
    getGuildForms: () => Promise.resolve({content: [
        {id: "f1", title: "LSPD Academy", status: "PUBLISHED"},
        {id: "f2", title: "EMS Academy", status: "ARCHIVED"},
    ]}),
}));

const guild = {guildId: "9", guildName: "LSRP", botStatus: "CONNECTED", role: "OWNER", since: ""} as MyGuild;

describe("server moderators", () => {
    afterEach(() => {
        cleanup();
        add.mockReset();
        remove.mockReset();
        search.mockReset();
        setForms.mockReset();
    });

    it("narrows a moderator to some forms and warns when none is chosen", async () => {
        setForms.mockImplementation((_g: string, _id: string, p: { restricted: boolean; formIds: string[] }) =>
            Promise.resolve({discordId: "2", username: "anna", role: "MODERATOR", since: "2026-09-02T00:00:00",
                formsRestricted: p.restricted, formIds: p.formIds}));
        const user = userEvent.setup();
        render(<ToastProvider><ModeratorsPanel guild={guild}/></ToastProvider>);

        // The owner has no forms button; a moderator starts with every form.
        const ownerRow = (await screen.findByText("kirill", {selector: "span.truncate"})).closest("li")!;
        expect(within(ownerRow).queryByText("moderators.formsAll")).toBeNull();
        await user.click(screen.getByRole("button", {name: "moderators.formsNamed:anna: moderators.formsAll"}));

        await user.click(screen.getByRole("radio", {name: "moderators.formsSomeOption"}));
        expect(await screen.findByText("moderators.formsNoneWarning")).toBeTruthy();
        expect(screen.getByText("moderators.formsArchived")).toBeTruthy();
        await user.click(screen.getByRole("checkbox", {name: "LSPD Academy"}));
        expect(screen.queryByText("moderators.formsNoneWarning")).toBeNull();
        await user.click(screen.getByRole("button", {name: "common.save"}));

        expect(setForms).toHaveBeenCalledWith("9", "2", {restricted: true, formIds: ["f1"]});
        expect(await screen.findByRole("button", {name: "moderators.formsNamed:anna: moderators.formsCount:1"})).toBeTruthy();
    });

    it("suggests server members, adds the picked one and removes a moderator after confirming", async () => {
        search.mockResolvedValue([{discordId: "612", username: "lena.vibe", displayName: null, avatarUrl: null, role: null}]);
        add.mockResolvedValue({discordId: "612", username: "lena.vibe", role: "MODERATOR", since: "2026-10-18T00:00:00", addedByName: "kirill"});
        remove.mockResolvedValue(undefined);
        const user = userEvent.setup();
        render(<ToastProvider><ModeratorsPanel guild={guild}/></ToastProvider>);

        expect(await screen.findByText("moderators.team:2")).toBeTruthy();
        const ownerRow = screen.getByText("kirill", {selector: "span.truncate"}).closest("li")!;
        expect(within(ownerRow).getByText("moderators.cantRemove")).toBeTruthy();

        await user.type(screen.getByRole("combobox"), "lena");
        const option = await screen.findByRole("option");
        expect(search).toHaveBeenCalledWith("9", "lena", expect.anything());
        await user.click(option);
        await user.click(screen.getByRole("button", {name: "moderators.add"}));
        expect(add).toHaveBeenCalledWith("9", {discordId: "612"});
        expect(await screen.findByText("moderators.team:3")).toBeTruthy();

        await user.click(screen.getByRole("button", {name: "moderators.removeNamed:anna"}));
        await user.click(screen.getByRole("button", {name: "moderators.remove"}));
        expect(remove).toHaveBeenCalledWith("9", "2");
        expect(await screen.findByText("moderators.team:2")).toBeTruthy();
    });
});
