// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {MyGuild} from "../../../api/dashboard";
import type {GuildAuditEntry} from "../../../api/moderation";
import GuildAuditPanel from "./GuildAuditPanel";

// A stable t, as react-i18next's is: the feed reloads when t changes.
const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue" && k !== "count").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
const feed = vi.fn();
vi.mock("../../../api/moderation", () => ({
    getGuildAuditLog: (...a: unknown[]) => feed(...a),
    getGuildAuditActors: () => Promise.resolve([{discordId: "7", username: "Кирилл Н."}]),
}));

const entry = (id: string, action: GuildAuditEntry["action"], metadata: Record<string, unknown> | null = null): GuildAuditEntry => ({
    id, action, actorDiscordId: "7", actorUsername: "Кирилл Н.", targetType: "SUBMISSION", targetId: "s",
    targetName: "Набор в EMS", metadata, createdAt: new Date().toISOString(),
});

const guild = {guildId: "1", guildName: "LSRP", botStatus: "CONNECTED", role: "MODERATOR", since: ""} as MyGuild;

describe("server journal", () => {
    afterEach(() => {
        cleanup();
        feed.mockReset();
    });

    it("shows a day's entries with their details, filters by kind and loads more by cursor", async () => {
        feed.mockResolvedValueOnce({
            items: [entry("a", "SUBMISSION_DECIDED", {to: "APPROVED", comment: "Добро пожаловать"}),
                entry("b", "FORM_UPDATED", {changes: ["fields"]})],
            nextCursor: "c1",
        });
        const user = userEvent.setup();
        render(<GuildAuditPanel guild={guild}/>);

        expect(await screen.findByText("guildAudit.what.decided.APPROVED")).toBeTruthy();
        expect(screen.getByText(/^guildAudit.today:/)).toBeTruthy();
        expect(screen.getByText("guildAudit.detail.comment:Добро пожаловать")).toBeTruthy();
        expect(screen.getByText("guildAudit.detail.changes:guildAudit.change.fields")).toBeTruthy();
        expect(feed).toHaveBeenLastCalledWith("1", expect.objectContaining({days: 7}));

        feed.mockResolvedValueOnce({items: [entry("c", "GUILD_BAN_ADDED", {reason: "спам"})], nextCursor: null});
        await user.click(screen.getByRole("button", {name: "guildAudit.more"}));
        expect(await screen.findByText("guildAudit.detail.reason:спам")).toBeTruthy();
        expect(feed).toHaveBeenLastCalledWith("1", expect.objectContaining({cursor: "c1"}));
        expect(screen.queryByRole("button", {name: "guildAudit.more"})).toBeNull();

        feed.mockResolvedValueOnce({items: [], nextCursor: null});
        await user.selectOptions(screen.getByRole("combobox", {name: /guildAudit.filter.action/}), "bans");
        expect(feed).toHaveBeenLastCalledWith("1", expect.objectContaining({actions: ["GUILD_BAN_ADDED", "GUILD_BAN_REMOVED"]}));
        expect(await screen.findByText("guildAudit.empty")).toBeTruthy();
    });
});
