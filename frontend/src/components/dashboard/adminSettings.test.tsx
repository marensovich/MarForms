// @vitest-environment jsdom
import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ToastProvider} from "../../ui";
import SettingsTab from "./SettingsTab";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
const SETTINGS = {
    systemName: "MarForms", systemContact: "support@marforms.app", uiLanguage: "ru",
    banMessage: "Ваш доступ к MarForms ограничен.", banAdminContact: "discord.gg/marforms-appeals",
    logWebhookUrl: "", logEnabledActions: "",
    globalEmbedColor: "#5865F2", globalEmbedTitle: "", globalEmbedDescription: "", globalEmbedFooterText: "MarForms",
    globalEmbedAuthorName: "", globalEmbedAuthorIcon: "", globalEmbedAuthorUrl: "", globalEmbedThumbnail: "", globalEmbedImage: "",
    globalEmbedFooterIcon: "",
};
const api = {fetchSettings: vi.fn(), updateSettings: vi.fn(), fetchLogWebhook: vi.fn(), testLogWebhook: vi.fn()};
vi.mock("../../api/settings", () => ({
    fetchSettings: () => api.fetchSettings(),
    updateSettings: (s: unknown) => api.updateSettings(s),
    fetchLogWebhook: () => api.fetchLogWebhook(),
    testLogWebhook: (url?: string) => api.testLogWebhook(url),
    getBotPresence: () => Promise.resolve({status: "ONLINE", activity: "NONE", text: ""}),
    setBotPresence: (p: unknown) => Promise.resolve(p),
}));
vi.mock("../../api/feedback", () => ({
    getFeedbackWebhook: () => Promise.resolve({webhookUrl: ""}),
    setFeedbackWebhook: (webhookUrl: string) => Promise.resolve({webhookUrl}),
    testFeedbackWebhook: () => Promise.resolve({ok: true}),
}));

describe("platform settings", () => {
    beforeEach(() => {
        api.fetchSettings.mockResolvedValue(SETTINGS);
        api.updateSettings.mockImplementation((s: unknown) => Promise.resolve(s));
        api.fetchLogWebhook.mockResolvedValue({configured: false, lastDelivery: null});
        api.testLogWebhook.mockResolvedValue({ok: true, status: "204", at: "2026-10-15T14:22:00"});
    });
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("inserts variables with a live preview, tests the log webhook, and saves the filters", async () => {
        const user = userEvent.setup();
        render(<ToastProvider><MemoryRouter><SettingsTab/></MemoryRouter></ToastProvider>);

        const text = await screen.findByLabelText("adminSettings.embed.description");
        await user.click(text);
        await user.click(screen.getByRole("button", {name: "{user.mention}"}));
        await user.type(text, " отправил заявку");
        expect((text as HTMLTextAreaElement).value).toBe("{user.mention} отправил заявку");
        expect(screen.getByText("@dmitry_ballas отправил заявку")).toBeTruthy();
        expect(screen.getByRole("region", {name: "adminSettings.unsaved"}).textContent).toContain("adminSettings.section.embed");

        await user.click(screen.getByLabelText("adminSettings.webhook.url"));
        await user.paste("https://discord.com/api/webhooks/1/t");
        await user.click(screen.getByRole("button", {name: "adminSettings.webhook.test"}));
        expect(api.testLogWebhook).toHaveBeenCalledWith("https://discord.com/api/webhooks/1/t");
        expect(await screen.findByText(/adminSettings.webhook.last:.*204 OK/)).toBeTruthy();

        await user.click(screen.getByRole("switch", {name: "logs.actions.USER_LOGIN"}));
        const bar = screen.getByRole("region", {name: "adminSettings.unsaved"});
        await user.click(within(bar).getByRole("button", {name: "common.save"}));
        const saved = api.updateSettings.mock.calls[0][0] as typeof SETTINGS;
        expect(saved.globalEmbedDescription).toBe("{user.mention} отправил заявку");
        expect(saved.logEnabledActions.split(",")).not.toContain("USER_LOGIN");
        expect(saved.logEnabledActions.split(",")).toContain("USER_BANNED");
        expect(screen.queryByRole("region", {name: "adminSettings.unsaved"})).toBeNull();
    });

    it("previews what a restricted user sees", async () => {
        const user = userEvent.setup();
        render(<ToastProvider><MemoryRouter><SettingsTab/></MemoryRouter></ToastProvider>);
        const message = await screen.findByLabelText("adminSettings.bans.message");
        await user.clear(message);
        await user.type(message, "Доступ закрыт администрацией.");
        const preview = screen.getByText("adminSettings.bans.preview").closest("figure")!;
        expect(within(preview).getByText("Доступ закрыт администрацией.")).toBeTruthy();
        expect(within(preview).getByText("discord.gg/marforms-appeals")).toBeTruthy();
    });
});
