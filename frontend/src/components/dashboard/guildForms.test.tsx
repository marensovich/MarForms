// @vitest-environment jsdom
import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {DashboardForm, MyGuild} from "../../api/dashboard";
import {ToastProvider} from "../../ui";
import GuildFormsPanel from "./GuildFormsPanel";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, o?: Record<string, unknown>) => {
            const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue").map(([, v]) => v);
            return values?.length ? `${key}:${values.join(",")}` : key;
        },
        i18n: {language: "ru"},
    }),
}));

vi.mock("./forms/FormWizard", () => ({default: () => null}));
vi.mock("./forms/FormEditModal", () => ({default: () => null}));
vi.mock("./forms/FormPreviewModal", () => ({default: () => null}));

const setStatus = vi.fn();
const copy = vi.fn();
let FORMS: DashboardForm[] = [];
vi.mock("../../api/dashboard", () => ({
    getGuildForms: () => Promise.resolve({content: FORMS}),
    getGuildUsage: () => Promise.resolve({plan: "FREE", usage: [{metric: "ACTIVE_FORMS", used: 4, limit: 5}]}),
    getGuildForm: vi.fn(),
    publishGuildForm: vi.fn(),
    setGuildFormStatus: (g: string, f: string, s: string) => setStatus(g, f, s),
    copyGuildForm: (g: string, f: string) => copy(g, f),
    deleteGuildForm: vi.fn(),
    exportFormCsv: vi.fn(),
}));

const form = (id: string, title: string, status: DashboardForm["status"], extra: Partial<DashboardForm> = {}): DashboardForm => ({
    id, title, status, active: status === "PUBLISHED", submissionCount: 0, createdAt: "2026-10-01T00:00:00",
    slug: status === "DRAFT" ? null : id, accessMode: "AUTHENTICATED", notificationHealth: "HEALTHY", ...extra,
});

const guild = (role: MyGuild["role"]): MyGuild => ({
    guildId: "1", guildName: "Los Santos RP", botStatus: "CONNECTED", role, since: "2026-10-01T00:00:00",
});

function renderPanel(role: MyGuild["role"] = "OWNER") {
    return render(
        <ToastProvider>
            <MemoryRouter><GuildFormsPanel guild={guild(role)}/></MemoryRouter>
        </ToastProvider>,
    );
}

describe("the server's forms tab", () => {
    afterEach(() => {
        cleanup();
        setStatus.mockReset();
        copy.mockReset();
    });

    it("counts forms per status, filters by segment and search, and warns about broken notifications", async () => {
        FORMS = [
            form("lspd", "Заявка в LSPD", "PUBLISHED", {submissionCount: 128, pendingCount: 12}),
            form("ems", "Набор в EMS", "PUBLISHED", {notificationHealth: "DEGRADED", notificationReason: "CHANNEL_UNAVAILABLE"}),
            form("ballas", "Заявка в банду Ballas", "DRAFT", {notificationHealth: null}),
            form("helpers", "Набор хелперов", "ARCHIVED", {notificationHealth: "INVALID"}),
        ];
        const user = userEvent.setup();
        renderPanel();

        expect(await screen.findByText("Заявка в LSPD")).toBeTruthy();
        // Archived forms don't raise the banner.
        expect(screen.getByRole("alert").textContent)
            .toContain("guildForms.banner.one:Набор в EMS,guildForms.banner.reason.CHANNEL_UNAVAILABLE");
        expect(screen.getByText("+12")).toBeTruthy();
        expect(screen.getByText("guildForms.notif.reason.CHANNEL_UNAVAILABLE")).toBeTruthy();
        expect(screen.getByText("guildForms.notif.none")).toBeTruthy();
        expect(await screen.findByText(/guildForms.activeOfLimit:4,5,Free/)).toBeTruthy();

        await user.click(screen.getByRole("radio", {name: /guildForms.segment.PUBLISHED/}));
        expect(screen.queryByText("Заявка в банду Ballas")).toBeNull();
        expect(screen.getByText("Набор в EMS")).toBeTruthy();

        await user.click(screen.getByRole("radio", {name: /guildForms.segment.all/}));
        await user.type(screen.getByRole("textbox", {name: "guildForms.search"}), "ballas");
        expect(screen.getAllByRole("row")).toHaveLength(2);
        expect(screen.getByText("Заявка в банду Ballas")).toBeTruthy();
    });

    it("offers only the transitions of ТЗ 4.4.2 and restores an archived form as a copy", async () => {
        FORMS = [
            form("draft", "Черновик", "DRAFT"),
            form("pub", "Опубликованная", "PUBLISHED"),
            form("arch", "Архивная", "ARCHIVED"),
        ];
        copy.mockResolvedValue({});
        const user = userEvent.setup();
        renderPanel();

        const menuOf = async (title: string) => {
            await user.click(await screen.findByRole("button", {name: `guildForms.more:${title}`}));
            const items = within(screen.getByRole("menu")).getAllByRole("menuitem").map(i => i.textContent);
            return items;
        };
        expect(await menuOf("Черновик")).toEqual(["guildForms.publish", "guildForms.delete"]);
        await user.keyboard("{Escape}");
        expect(await menuOf("Опубликованная")).toEqual(["guildForms.close", "guildForms.archive", "guildForms.delete"]);
        await user.keyboard("{Escape}");
        expect(await menuOf("Архивная")).toEqual(["guildForms.restoreCopy", "guildForms.delete"]);

        await user.click(screen.getByRole("menuitem", {name: /guildForms.restoreCopy/}));
        expect(copy).toHaveBeenCalledWith("1", "arch");
        expect(await screen.findByText("guildForms.done.copy:Архивная")).toBeTruthy();
        // An archived form is read-only: no edit button.
        const archivedRow = screen.getByText("Архивная").closest("tr")!;
        expect(within(archivedRow).queryByRole("button", {name: "common.edit"})).toBeNull();
    });

    it("gives moderators the list, preview and links but no actions", async () => {
        FORMS = [form("pub", "Опубликованная", "PUBLISHED")];
        renderPanel("MODERATOR");
        const row = (await screen.findByText("Опубликованная")).closest("tr")!;
        expect(within(row).getByRole("button", {name: "guildForms.preview"})).toBeTruthy();
        expect(within(row).getByRole("button", {name: "guildForms.copyLink"})).toBeTruthy();
        expect(within(row).queryByRole("button", {name: /guildForms.more/})).toBeNull();
        expect(within(row).queryByRole("button", {name: "common.edit"})).toBeNull();
    });
});
