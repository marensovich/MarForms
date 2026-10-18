// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {SystemInfo} from "../../api/system";
import SystemTab from "./SystemTab";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
const api = {fetchSystemInfo: vi.fn(), fetchUpdates: vi.fn(), checkUpdates: vi.fn()};
vi.mock("../../api/system", () => ({
    fetchSystemInfo: () => api.fetchSystemInfo(),
    fetchUpdates: () => api.fetchUpdates(),
    checkUpdates: () => api.checkUpdates(),
}));

const GB = 1024 ** 3;
const INFO: SystemInfo = {
    cpu: {usage: 38, cores: 8, loadAverage: [2.41, 2.1, 1.96]},
    ram: {used: 11.4 * GB, total: 16 * GB, heapUsed: 3.2 * GB, heapMax: 4 * GB},
    disk: {used: 92 * GB, total: 200 * GB, uploads: 61 * GB, database: 18 * GB},
    about: {os: "Linux 6.8 · amd64", jvm: "Eclipse Adoptium 25", version: "2.8.1", commit: "a41c9e2", uptimeSeconds: 18 * 86400 + 6 * 3600 + 42 * 60},
    jobs: {queued: 14, failed: 3, succeeded24h: 8412},
    webhooks: {healthy: 47, degraded: 2, invalid: 1},
    at: "2026-10-19T09:00:00",
};
const UPDATES = {current: "2.8.1", latest: null, available: false, notes: null, url: null, checkedAt: "2026-10-19T09:00:00", error: null};

describe("system", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        api.fetchSystemInfo.mockResolvedValue(INFO);
        api.fetchUpdates.mockResolvedValue(UPDATES);
        api.checkUpdates.mockResolvedValue({...UPDATES, latest: "2.9.0", available: true, notes: "Условия по ролям в вебхуках"});
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("reads every 3 seconds, dims stale data when the backend stops answering, and checks updates", async () => {
        render(<SystemTab/>);
        await act(() => vi.advanceTimersByTimeAsync(0));

        expect(screen.getByText("adminSystem.live")).toBeTruthy();
        expect(screen.getByText("(a41c9e2)")).toBeTruthy();
        expect(screen.getByText("adminSystem.load:2,41 · 2,10 · 1,96")).toBeTruthy();
        expect(screen.getByText("adminSystem.webhooks.split:94,4,2,50")).toBeTruthy();
        expect(screen.getByText("8 412")).toBeTruthy();

        api.fetchSystemInfo.mockRejectedValue(new Error("down"));
        await act(() => vi.advanceTimersByTimeAsync(3000));
        expect(api.fetchSystemInfo).toHaveBeenCalledTimes(2);
        const banner = screen.getByRole("alert");
        expect(banner.textContent).toContain("adminSystem.down");
        expect(banner.textContent).toContain("adminSystem.staleShown");
        expect(document.querySelector(".opacity-45")).toBeTruthy();

        api.fetchSystemInfo.mockResolvedValue(INFO);
        fireEvent.click(screen.getByRole("button", {name: "adminSystem.retryNow"}));
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(api.fetchSystemInfo).toHaveBeenCalledTimes(3);
        expect(screen.queryByRole("alert")).toBeNull();

        fireEvent.click(screen.getByRole("button", {name: "adminSystem.updates.check"}));
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(api.checkUpdates).toHaveBeenCalled();
        expect(screen.getByText("adminSystem.updates.available:2.9.0")).toBeTruthy();
    });
});
