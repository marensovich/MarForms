// @vitest-environment jsdom
import {act, cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {AuditLogEntry} from "../../types/logs";
import LogsTab from "./LogsTab";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
vi.mock("../../api/client", () => ({ApiError: class extends Error {
    status = 500;
}}));
let pushEntry: (e: AuditLogEntry) => void = () => undefined;
const api = {getAuditLogs: vi.fn(), getLogStats: vi.fn()};
vi.mock("../../api/logs", () => ({
    getAuditLogs: (f: unknown) => api.getAuditLogs(f),
    getLogStats: () => api.getLogStats(),
    streamAuditLogs: (onEntry: (e: AuditLogEntry) => void, onOpen: () => void) => {
        pushEntry = onEntry;
        onOpen();
        return new Promise(() => undefined);
    },
}));

const entry = (id: string, action: AuditLogEntry["action"], extra: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
    id, action, actorDiscordId: "284019574330621952", actorUsername: "Мария S.", actorAvatarUrl: null,
    targetId: "f1", targetName: "Набор в LSPD", targetType: "FORM", guildId: null, details: null, diff: [],
    createdAt: "2026-10-15T14:22:08", ...extra,
});

describe("platform log", () => {
    beforeEach(() => {
        api.getAuditLogs.mockResolvedValue({
            content: [entry("e1", "FORM_UPDATED", {diff: [{field: "closesAt", before: "2026-10-20T23:59", after: "2026-10-31T23:59"}]}),
                entry("e2", "USER_BANNED", {targetName: "boris_tm", details: "Мультиаккаунты"})],
            page: {totalElements: 2, totalPages: 1},
        });
        api.getLogStats.mockResolvedValue({total: 128406, today: 2941, decisions: 612, restrictions: 9, rights: 3});
    });
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("opens a change into its diff, filters by several actions, and shows live entries", async () => {
        const user = userEvent.setup();
        render(<LogsTab/>);

        expect(await screen.findByText("Набор в LSPD")).toBeTruthy();
        expect(screen.getByText("adminLogs.changedFields:1")).toBeTruthy();
        await user.click(screen.getByRole("button", {name: "adminLogs.expand"}));
        const diff = screen.getAllByRole("table")[1];
        expect(within(diff).getByText("closesAt")).toBeTruthy();
        expect(within(diff).getByText("2026-10-31T23:59")).toBeTruthy();

        await user.click(screen.getByRole("button", {name: /adminLogs.action/}));
        await user.click(screen.getByRole("checkbox", {name: "logs.actions.USER_BANNED"}));
        await user.click(screen.getByRole("checkbox", {name: "logs.actions.USER_TIMED_OUT"}));
        expect(api.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({actions: ["USER_BANNED", "USER_TIMED_OUT"]}));
        await screen.findByText("boris_tm");

        act(() => pushEntry(entry("e3", "USER_TIMED_OUT", {targetName: "vlad.kozlov", details: "Спам"})));
        expect(screen.getByText("vlad.kozlov")).toBeTruthy();
        act(() => pushEntry(entry("e4", "FORM_CREATED", {targetName: "Новая форма"})));
        expect(screen.queryByText("Новая форма")).toBeNull();
    });
});
