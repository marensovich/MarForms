// @vitest-environment jsdom
import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {ReactNode} from "react";
import {MemoryRouter, Route, Routes, useLocation} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import {ApiError} from "../../../api/client";
import type {MyGuild} from "../../../api/dashboard";
import type {ModerationSubmission, SubmissionDetail} from "../../../api/moderation";
import {ToastProvider} from "../../../ui";
import GuildModerationPanel from "./GuildModerationPanel";
import SubmissionCardModal from "./SubmissionCardModal";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, o?: Record<string, unknown>) => {
            const values = o && Object.values(o).filter(v => typeof v === "string" || typeof v === "number");
            return values?.length ? `${key}:${values.join(",")}` : key;
        },
        i18n: {language: "ru"},
    }),
}));
const detail = vi.fn();
const decide = vi.fn();
const list = vi.fn();
vi.mock("../../../api/moderation", () => ({
    getSubmissionDetail: (id: string) => detail(id),
    decideSubmission: (...a: unknown[]) => decide(...a),
    downloadSubmissionFile: vi.fn(),
    getGuildSubmissions: (...a: unknown[]) => list(...a),
}));
vi.mock("../../../api/dashboard", () => ({
    getGuildForms: () => Promise.resolve({content: [{id: "f1", title: "LSPD"}]}),
}));

const row = (id: string, status: ModerationSubmission["status"], name: string): ModerationSubmission => ({
    id, formId: "f1", discordId: "2", createdAt: "2026-10-15T10:00:00", answers: {}, status, number: 1043,
    moderatorDiscordId: null, moderatorComment: null, decidedAt: null, discordUsername: name, formTitle: "LSPD",
});

function card(status: ModerationSubmission["status"]): SubmissionDetail {
    return {
        submission: row("s1", status, "alice"),
        formId: "f1", schema: {title: "LSPD", description: "", fields: []}, author: null, files: [],
        history: [{type: "SUBMITTED", from: null, to: "PENDING", actorName: "alice", comment: null, at: "2026-10-15T10:00:00"}],
    };
}

const wrap = (node: ReactNode) => <ToastProvider>{node}</ToastProvider>;

describe("moderation card", () => {
    afterEach(() => {
        cleanup();
        detail.mockReset();
        decide.mockReset();
        list.mockReset();
    });

    it("asks for a comment before rejecting and names who decided first", async () => {
        detail.mockResolvedValue(card("PENDING"));
        const user = userEvent.setup();
        render(wrap(<SubmissionCardModal submissionId="s1" onClose={() => {}} onDecided={() => {}}/>));

        expect(await screen.findByRole("heading", {name: "moderation.card.titleNumber:1043"})).toBeTruthy();
        expect(screen.getByText("moderation.card.event.SUBMITTED")).toBeTruthy();
        const confirm = screen.getByRole("button", {name: "moderation.card.confirm"});
        expect((confirm as HTMLButtonElement).disabled).toBe(true);

        await user.click(screen.getByRole("button", {name: "moderation.decide.REJECTED"}));
        expect(screen.getByRole("button", {name: "moderation.decide.REJECTED"}).getAttribute("aria-pressed")).toBe("true");
        await user.click(confirm);
        expect(screen.getByRole("alert").textContent).toBe("moderation.card.commentRequired");
        expect(decide).not.toHaveBeenCalled();

        decide.mockRejectedValue(new ApiError(409, JSON.stringify({decidedBy: "mod", decidedAt: "2026-10-15T11:00:00"})));
        await user.type(screen.getByRole("textbox"), "Too short");
        await user.click(screen.getByRole("button", {name: "moderation.decide.REJECTED"}));
        await user.click(confirm);
        expect(decide).toHaveBeenCalledWith("s1", "REJECTED", "Too short", "PENDING");
        expect((await screen.findByRole("alert")).textContent).toMatch(/^moderation.card.conflictBy:mod/);
    });

    it("lets only the owner reopen an approved submission", async () => {
        detail.mockResolvedValue(card("APPROVED"));
        render(wrap(<SubmissionCardModal submissionId="s1" onClose={() => {}} onDecided={() => {}}/>));
        await screen.findByText("moderation.card.event.SUBMITTED");
        expect(screen.queryByRole("button", {name: "moderation.decide.reopen"})).toBeNull();
        expect(screen.queryByRole("button", {name: "moderation.card.confirm"})).toBeNull();
        cleanup();

        render(wrap(<SubmissionCardModal submissionId="s1" onClose={() => {}} onDecided={() => {}} canReopen/>));
        expect(await screen.findByRole("button", {name: "moderation.decide.reopen"})).toBeTruthy();
    });
});

describe("moderation queue", () => {
    afterEach(() => {
        cleanup();
        list.mockReset();
        detail.mockReset();
    });

    const guild = {guildId: "1", guildName: "LSRP", botStatus: "CONNECTED", role: "MODERATOR", since: ""} as MyGuild;
    let search = "";
    function Spy() {
        search = useLocation().search;
        return null;
    }

    it("keeps its filters in the URL, pending by default, and walks the page from the card", async () => {
        list.mockResolvedValue({content: [row("s1", "PENDING", "alice"), row("s2", "PENDING", "bob")], page: {totalElements: 2, totalPages: 1}});
        detail.mockImplementation((id: string) => Promise.resolve({...card("PENDING"), submission: row(id, "PENDING", id)}));
        const user = userEvent.setup();
        render(wrap(
            <MemoryRouter initialEntries={["/s/1/submissions"]}>
                <Routes><Route path="/s/1/submissions" element={<><GuildModerationPanel guild={guild}/><Spy/></>}/></Routes>
            </MemoryRouter>,
        ));

        expect(await screen.findByText("alice")).toBeTruthy();
        expect(list).toHaveBeenLastCalledWith("1", expect.objectContaining({status: "PENDING", page: 0}));
        expect(screen.getByText("moderation.range:1,2,2")).toBeTruthy();

        await user.selectOptions(screen.getByRole("combobox", {name: /moderation.columns.status/}), "all");
        expect(search).toBe("?status=all");
        expect(list).toHaveBeenLastCalledWith("1", expect.objectContaining({status: undefined}));

        await user.click(screen.getByText("alice"));
        expect(search).toContain("submission=s1");
        const dialog = await screen.findByRole("dialog");
        expect((within(dialog).getByRole("button", {name: "moderation.card.prev"}) as HTMLButtonElement).disabled).toBe(true);
        await user.click(within(dialog).getByRole("button", {name: "moderation.card.next"}));
        expect(search).toContain("submission=s2");

        await user.click(screen.getByRole("button", {name: "moderation.filter.reset"}));
        expect(search).toBe("?submission=s2");
    });
});
