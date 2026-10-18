// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {MyGuild} from "../../../api/dashboard";
import {ToastProvider} from "../../../ui";
import BansPanel from "./BansPanel";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
const ban = vi.fn();
const unban = vi.fn();
vi.mock("../../../api/dashboard", () => ({
    getGuildBans: () => Promise.resolve([{discordId: "771", username: "spam_bot", reason: "спам", bannedBy: "1",
        bannedByUsername: "dmitry.w", createdAt: "2026-10-15T10:00:00", expiresAt: null}]),
    banGuildUser: (...a: unknown[]) => ban(...a),
    unbanGuildUser: (...a: unknown[]) => unban(...a),
}));

const guild = {guildId: "9", guildName: "LSRP", botStatus: "CONNECTED", role: "MODERATOR", since: ""} as MyGuild;

describe("server bans", () => {
    afterEach(() => {
        cleanup();
        ban.mockReset();
        unban.mockReset();
    });

    it("bans for a term and lifts a ban after confirming", async () => {
        ban.mockImplementation((_g: string, p: { expiresAt: string | null }) => Promise.resolve({
            discordId: "603", username: "toxic", reason: "оскорбления", bannedBy: "1", bannedByUsername: "anna",
            createdAt: "2026-10-18T10:00:00", expiresAt: p.expiresAt,
        }));
        unban.mockResolvedValue(undefined);
        const user = userEvent.setup();
        render(<ToastProvider><BansPanel guild={guild}/></ToastProvider>);

        expect(await screen.findByText("bans.listTitle:1")).toBeTruthy();
        expect(screen.getAllByText("bans.forever").length).toBeGreaterThan(0);

        await user.type(screen.getByLabelText("bans.who"), "603847102938475611");
        await user.type(screen.getByLabelText("bans.reason"), "оскорбления");
        await user.selectOptions(screen.getByLabelText("bans.term"), "7");
        await user.click(screen.getByRole("button", {name: "bans.add"}));
        const [, payload] = ban.mock.calls[0];
        expect(payload).toMatchObject({discordId: "603847102938475611", reason: "оскорбления"});
        const days = (new Date(payload.expiresAt).getTime() - Date.now()) / 86_400_000;
        expect(days).toBeGreaterThan(6.9);
        expect(await screen.findByText("bans.listTitle:2")).toBeTruthy();

        await user.click(screen.getByRole("button", {name: "bans.removeNamed:spam_bot"}));
        await user.click(screen.getByRole("button", {name: "bans.remove"}));
        expect(unban).toHaveBeenCalledWith("9", "771");
        expect(await screen.findByText("bans.listTitle:1")).toBeTruthy();
    });
});
