// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, describe, expect, it, vi} from "vitest";
import {ApiError} from "../../../api/client";
import type {SubmissionDetail} from "../../../api/moderation";
import SubmissionCardModal from "./SubmissionCardModal";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, o?: Record<string, string>) => o?.name ? `${key}:${o.name}` : key,
        i18n: {language: "ru"},
    }),
}));
const detail = vi.fn();
const decide = vi.fn();
vi.mock("../../../api/moderation", () => ({
    getSubmissionDetail: (id: string) => detail(id),
    decideSubmission: (...a: unknown[]) => decide(...a),
    downloadSubmissionFile: vi.fn(),
}));

function card(status: SubmissionDetail["submission"]["status"]): SubmissionDetail {
    return {
        submission: {
            id: "s1", formId: "f1", discordId: "2", createdAt: "2026-10-15T10:00:00", answers: {}, status,
            moderatorDiscordId: null, moderatorComment: null, decidedAt: null, discordUsername: "alice", formTitle: "LSPD",
        },
        formId: "f1", schema: {title: "LSPD", description: "", fields: []}, author: null, files: [],
        history: [{type: "SUBMITTED", from: null, to: "PENDING", actorName: "alice", comment: null, at: "2026-10-15T10:00:00"}],
    };
}

describe("moderation card", () => {
    afterEach(() => {
        cleanup();
        detail.mockReset();
        decide.mockReset();
    });

    it("asks for a comment before rejecting and names who decided first", async () => {
        detail.mockResolvedValue(card("PENDING"));
        const user = userEvent.setup();
        render(<SubmissionCardModal submissionId="s1" onClose={() => {}} onDecided={() => {}}/>);

        expect(await screen.findByText("submissionHistory.SUBMITTED")).toBeTruthy();
        await user.click(screen.getByRole("button", {name: "moderation.decide.REJECTED"}));
        expect(screen.getByRole("alert").textContent).toBe("moderation.card.commentRequired");
        expect(decide).not.toHaveBeenCalled();

        decide.mockRejectedValue(new ApiError(409, JSON.stringify({decidedBy: "mod", decidedAt: "2026-10-15T11:00:00"})));
        await user.type(screen.getByRole("textbox"), "Too short");
        await user.click(screen.getByRole("button", {name: "moderation.decide.REJECTED"}));
        expect((await screen.findByRole("alert")).textContent).toBe("moderation.card.conflictBy:mod");
    });

    it("lets only the owner reopen an approved submission", async () => {
        detail.mockResolvedValue(card("APPROVED"));
        render(<SubmissionCardModal submissionId="s1" onClose={() => {}} onDecided={() => {}}/>);
        await screen.findByText("submissionHistory.SUBMITTED");
        expect(screen.queryByRole("button", {name: "moderation.decide.reopen"})).toBeNull();
        expect(screen.queryByRole("button", {name: "moderation.decide.APPROVED"})).toBeNull();
        cleanup();

        render(<SubmissionCardModal submissionId="s1" onClose={() => {}} onDecided={() => {}} canReopen/>);
        expect(await screen.findByRole("button", {name: "moderation.decide.reopen"})).toBeTruthy();
    });
});
