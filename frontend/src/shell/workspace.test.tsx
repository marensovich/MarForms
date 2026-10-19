// @vitest-environment jsdom
import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Outlet, Route, Routes} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {MyGuild} from "../api/dashboard";
import ServersTab from "../components/dashboard/ServersTab";
import type {DashboardContext} from "./dashboardContext";
import GuildWorkspaceHeader from "./GuildWorkspaceHeader";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, o?: Record<string, unknown>) => o && Object.keys(o).length ? `${key}:${Object.values(o).join(",")}` : key,
        i18n: {language: "ru"},
    }),
}));
const connectUrl = vi.fn();
vi.mock("../api/dashboard", () => ({
    getGuildConnectUrl: (id?: string) => connectUrl(id),
    refreshMyGuilds: vi.fn(),
    getGuildUsage: () => Promise.resolve({plan: "FREE", usage: [{metric: "ACTIVE_FORMS", used: 4, limit: 5}]}),
}));

const guild = (id: string, name: string, role: MyGuild["role"], extra: Partial<MyGuild> = {}): MyGuild => ({
    guildId: id, guildName: name, botStatus: "CONNECTED", role, since: "2026-10-01T00:00:00", memberCount: 1240,
    botState: "CONNECTED", missingPermissions: [], activeForms: 3, pendingSubmissions: 5, ...extra,
});

const GUILDS: MyGuild[] = [
    guild("1", "Los Santos RP", "OWNER", {botState: "MISSING_PERMISSIONS", missingPermissions: ["MANAGE_WEBHOOKS"]}),
    guild("2", "Vinewood Life", "MODERATOR"),
    guild("3", "Grove Street", "OWNER", {botState: "KICKED", botStatus: "KICKED"}),
];

function Layout({guilds}: { guilds: MyGuild[] }) {
    const context: DashboardContext = {guilds, reloadGuilds: () => {}};
    return <Outlet context={context}/>;
}

describe("my servers", () => {
    afterEach(() => {
        cleanup();
        connectUrl.mockReset();
    });

    it("shows each server's bot state with a way to fix it, and filters by role", async () => {
        connectUrl.mockReturnValue(new Promise(() => {}));
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={["/dashboard/servers"]}>
                <Routes><Route element={<Layout guilds={GUILDS}/>}><Route path="/dashboard/servers" element={<ServersTab/>}/></Route></Routes>
            </MemoryRouter>,
        );
        const lsrp = screen.getByRole("heading", {name: "Los Santos RP"}).closest("article")!;
        expect(within(lsrp).getByText("servers.bot.MISSING_PERMISSIONS:servers.permission.MANAGE_WEBHOOKS")).toBeTruthy();
        await user.click(within(lsrp).getByRole("button", {name: "servers.grant"}));
        expect(connectUrl).toHaveBeenCalledWith("1");

        const grove = screen.getByRole("heading", {name: "Grove Street"}).closest("article")!;
        expect(within(grove).getByRole("button", {name: "servers.inviteAgain"})).toBeTruthy();
        // A moderator can't re-invite the bot.
        const vinewood = screen.getByRole("heading", {name: "Vinewood Life"}).closest("article")!;
        expect(within(vinewood).queryByRole("button")).toBeNull();
        expect(within(vinewood).getByRole("link", {name: /servers.open/}).getAttribute("href")).toBe("/dashboard/servers/2/forms");

        await user.click(screen.getByRole("radio", {name: /forms.guilds.role.moderator/}));
        expect(screen.queryByRole("heading", {name: "Los Santos RP"})).toBeNull();
        expect(screen.getByRole("heading", {name: "Vinewood Life"})).toBeTruthy();
    });

    it("explains how to start when there are no servers", () => {
        render(
            <MemoryRouter>
                <Routes><Route element={<Layout guilds={[]}/>}><Route path="*" element={<ServersTab/>}/></Route></Routes>
            </MemoryRouter>,
        );
        expect(screen.getByText("servers.emptyTitle")).toBeTruthy();
    });
});

describe("server workspace header", () => {
    afterEach(cleanup);

    it("gives the owner every tab and the plan's counters", async () => {
        render(<MemoryRouter><GuildWorkspaceHeader guild={GUILDS[0]} section="forms"/></MemoryRouter>);
        const tabs = within(screen.getByRole("navigation")).getAllByRole("link").map(l => l.textContent);
        expect(tabs).toEqual(["shell.guild.forms", "shell.guild.submissions5", "shell.guild.audit",
            "shell.guild.moderators", "shell.guild.bans", "shell.guild.billing", "shell.guild.settings"]);
        expect(await screen.findByRole("progressbar", {name: "workspace.activeForms"})).toBeTruthy();
    });

    it("hides moderators and billing from a moderator", () => {
        render(<MemoryRouter><GuildWorkspaceHeader guild={GUILDS[1]} section="submissions"/></MemoryRouter>);
        const tabs = within(screen.getByRole("navigation")).getAllByRole("link");
        expect(tabs.map(l => l.textContent)).not.toContain("shell.guild.moderators");
        expect(tabs.map(l => l.textContent)).not.toContain("shell.guild.billing");
        expect(tabs.find(l => l.getAttribute("aria-current") === "page")?.getAttribute("href")).toBe("/dashboard/servers/2/submissions");
        expect(screen.queryByRole("link", {name: /forms.newForm/})).toBeNull();
    });
});
