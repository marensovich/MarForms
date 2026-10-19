// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "../auth/AuthContextDefinition";
import FeedbackPage from "./FeedbackPage";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string, o?: { defaultValue?: string }) => (o && "defaultValue" in o ? o.defaultValue ?? "" : key), i18n: {language: "ru", changeLanguage: vi.fn()}}),
}));
const send = vi.fn();
vi.mock("../api/feedback", async importOriginal => ({
    ...(await importOriginal<typeof import("../api/feedback")>()),
    sendFeedback: (...a: unknown[]) => send(...a),
}));

function show(path = "/feedback") {
    render(
        <AuthContext.Provider value={{
            user: {id: "1", discordUsername: "dmitry", avatarUrl: null, role: "", guildIds: [], permissions: [], permissionsHash: "h"},
            loading: false, login: async () => {}, logout: () => {}, banData: null,
        }}>
            <MemoryRouter initialEntries={[path]}><FeedbackPage/></MemoryRouter>
        </AuthContext.Provider>,
    );
}

describe("feedback", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("asks a bug its own questions and sends only once they are answered", async () => {
        const user = userEvent.setup();
        send.mockResolvedValue({id: "f1", delivered: true});
        show("/feedback?from=%2Fdashboard%2Fservers");

        await user.click(screen.getByRole("radio", {name: /feedback.kinds.BUG.title/}));
        expect(screen.getByLabelText(/feedback.q.BUG.steps/)).toBeTruthy();
        expect(screen.queryByLabelText(/feedback.q.IDEA.proposal/)).toBeNull();

        await user.click(screen.getByRole("button", {name: "feedback.send"}));
        expect(send).not.toHaveBeenCalled();
        expect(screen.getAllByText("feedback.required").length).toBeGreaterThan(0);

        await user.type(screen.getByLabelText(/feedback.q.BUG.title/), "Кнопка");
        await user.type(screen.getByLabelText(/feedback.q.BUG.steps/), "Нажать");
        await user.type(screen.getByLabelText(/feedback.q.BUG.actual/), "Ничего");
        await user.click(screen.getByRole("radio", {name: "feedback.option.severity.MINOR"}));
        await user.click(screen.getByRole("button", {name: "feedback.send"}));

        expect(send).toHaveBeenCalledWith("BUG", {title: "Кнопка", steps: "Нажать", actual: "Ничего", severity: "MINOR"}, "/dashboard/servers");
        expect(await screen.findByText("feedback.thanks")).toBeTruthy();
    });

    it("an idea asks other questions", async () => {
        const user = userEvent.setup();
        show();
        await user.click(screen.getByRole("radio", {name: /feedback.kinds.IDEA.title/}));
        expect(screen.getByLabelText(/feedback.q.IDEA.proposal/)).toBeTruthy();
        expect(screen.queryByLabelText(/feedback.q.BUG.steps/)).toBeNull();
    });
});
