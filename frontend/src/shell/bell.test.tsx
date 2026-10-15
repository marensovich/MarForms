// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Route, Routes, useLocation} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import NotificationBell from "./NotificationBell";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, o?: Record<string, unknown>) => o ? `${key}:${Object.values(o).join(",")}` : key,
        i18n: {language: "ru"},
    }),
}));
const count = vi.fn();
const list = vi.fn();
const read = vi.fn();
const readAll = vi.fn();
vi.mock("../api/notifications", () => ({
    getUnreadNotificationCount: () => count(),
    getNotifications: () => list(),
    markNotificationRead: (id: string) => read(id),
    markAllNotificationsRead: () => readAll(),
}));

function Where() {
    const l = useLocation();
    return <span data-testid="where">{l.pathname + l.search}</span>;
}

function show() {
    render(
        <MemoryRouter initialEntries={["/dashboard/servers"]}>
            <NotificationBell/>
            <Routes><Route path="*" element={<Where/>}/></Routes>
        </MemoryRouter>,
    );
}

describe("notification bell", () => {
    afterEach(() => {
        cleanup();
        [count, list, read, readAll].forEach(m => m.mockReset());
    });

    it("counts the unread, opens the list and leads to the object", async () => {
        count.mockResolvedValue({count: 2});
        list.mockResolvedValue({
            content: [{
                id: "n1", type: "NEW_SUBMISSION", guildId: "1", targetId: "s1", params: {form: "LSPD", author: "dmitry"},
                link: "/dashboard/servers/1/submissions?submission=s1", createdAt: "2026-10-15T10:00:00", read: false,
            }],
            page: {number: 0, totalPages: 1, totalElements: 1, size: 15},
        });
        read.mockResolvedValue(undefined);
        const user = userEvent.setup();
        show();

        const bell = await screen.findByRole("button", {name: "notifications.labelUnread:2"});
        await user.click(bell);
        await user.click(await screen.findByRole("button", {name: /notifications.types.NEW_SUBMISSION:LSPD,dmitry/}));
        expect(read).toHaveBeenCalledWith("n1");
        expect(screen.getByTestId("where").textContent).toBe("/dashboard/servers/1/submissions?submission=s1");
    });

    it("marks everything read", async () => {
        count.mockResolvedValue({count: 1});
        list.mockResolvedValue({content: [], page: {number: 0, totalPages: 0, totalElements: 0, size: 15}});
        readAll.mockResolvedValue(undefined);
        const user = userEvent.setup();
        show();

        await user.click(await screen.findByRole("button", {name: "notifications.labelUnread:1"}));
        expect(await screen.findByText("notifications.empty")).toBeTruthy();
        await user.click(screen.getByRole("button", {name: "notifications.readAll"}));
        expect(readAll).toHaveBeenCalled();
        expect(await screen.findByRole("button", {name: "notifications.label"})).toBeTruthy();
    });
});
