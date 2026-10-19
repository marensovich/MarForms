import {describe, expect, it} from "vitest";
import {foldDiff, foldRuns} from "./auditRuns";

const entry = (id: string, at: string, over: Partial<{ action: string; actorDiscordId: string | null; targetId: string | null }> = {}) => ({
    id, action: "FORM_UPDATED", actorDiscordId: "1", targetId: "form-1", createdAt: `2026-10-19T${at}:00`, lastAt: null, ...over,
});

describe("journal runs", () => {
    it("folds a run of one action by one person on one object into a line spanning it", () => {
        const lines = foldRuns([entry("c", "15:29"), entry("b", "15:27"), entry("a", "15:25")]);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({id: "c", createdAt: "2026-10-19T15:25:00", lastAt: "2026-10-19T15:29:00", count: 3});
    });

    it("keeps apart other people, other objects, other actions and long pauses", () => {
        const lines = foldRuns([
            entry("e", "16:00"),
            entry("d", "15:29", {actorDiscordId: "2"}),
            entry("c", "15:28", {targetId: "form-2"}),
            entry("b", "15:27", {action: "FORM_CREATED"}),
            entry("a", "15:00"),
        ]);
        expect(lines.map(l => l.id)).toEqual(["e", "d", "c", "b", "a"]);
    });

    it("counts the saves the server already merged", () => {
        const lines = foldRuns([{...entry("b", "15:30"), metadata: {edits: 4}}, {...entry("a", "15:25"), metadata: {edits: 2}}]);
        expect(lines[0].count).toBe(6);
    });

    it("folds the diff to the first before and the last after", () => {
        expect(foldDiff([
            [{field: "title", before: "B", after: "C"}, {field: "slug", before: "y", after: "x"}],
            [{field: "title", before: "A", after: "B"}, {field: "slug", before: "x", after: "y"}],
        ])).toEqual([{field: "title", before: "A", after: "C"}]);
    });
});
