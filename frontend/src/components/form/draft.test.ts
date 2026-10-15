import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {FormField} from "../../types/forms";
import {clearDraft, draftKey, loadDraft, saveDraft} from "./draft";

const field = (id: string, type: FormField["type"], options?: string[]): FormField =>
    ({id, type, label: id, required: false, options} as FormField);

const FIELDS = [
    field("nick", "TEXT"),
    field("age", "NUMBER"),
    field("faction", "SELECT", ["LSPD", "EMS"]),
    field("days", "CHECKBOX", ["Пн", "Вт", "Ср"]),
    field("passport", "FILE_UPLOAD"),
    field("section", "SECTION_BREAK"),
];

describe("form draft", () => {
    let store: Record<string, string>;

    beforeEach(() => {
        store = {};
        vi.stubGlobal("localStorage", {
            getItem: (k: string) => store[k] ?? null,
            setItem: (k: string, v: string) => { store[k] = v; },
            removeItem: (k: string) => { delete store[k]; },
        });
    });

    afterEach(() => vi.unstubAllGlobals());

    it("restores what was typed, without files", () => {
        const at = new Date("2026-10-15T14:22:00Z");
        expect(saveDraft("f1", FIELDS, {nick: "Kirill", age: 21, faction: "LSPD", days: ["Пн"], passport: ["upload-1"]}, at)).toBe(at);
        const draft = loadDraft("f1", FIELDS);
        expect(draft?.answers).toEqual({nick: "Kirill", age: 21, faction: "LSPD", days: ["Пн"]});
        expect(draft?.savedAt.toISOString()).toBe(at.toISOString());
    });

    it("keeps only what still fits a changed form", () => {
        saveDraft("f1", FIELDS, {nick: "Kirill", age: 21, faction: "EMS", days: ["Пн", "Ср"]});
        const changed = [
            field("nick", "TEXTAREA"),             // type changed → dropped
            field("faction", "SELECT", ["LSPD"]),  // option removed → dropped
            field("days", "CHECKBOX", ["Пн"]),     // only the remaining option stays
        ];
        expect(loadDraft("f1", changed)?.answers).toEqual({days: ["Пн"]});
    });

    it("clears after submission and when the answers are emptied", () => {
        saveDraft("f1", FIELDS, {nick: "Kirill"});
        clearDraft("f1");
        expect(store[draftKey("f1")]).toBeUndefined();

        saveDraft("f1", FIELDS, {nick: "Kirill"});
        expect(saveDraft("f1", FIELDS, {nick: ""})).toBeNull();
        expect(store[draftKey("f1")]).toBeUndefined();
    });

    it("is per form", () => {
        saveDraft("f1", FIELDS, {nick: "A"});
        expect(loadDraft("f2", FIELDS)).toBeNull();
    });

    it("ignores broken data and storage that throws", () => {
        store[draftKey("f1")] = "{not json";
        expect(loadDraft("f1", FIELDS)).toBeNull();
        vi.stubGlobal("localStorage", {
            getItem: () => { throw new Error("denied"); },
            setItem: () => { throw new Error("denied"); },
            removeItem: () => { throw new Error("denied"); },
        });
        expect(saveDraft("f1", FIELDS, {nick: "A"})).toBeNull();
        expect(loadDraft("f1", FIELDS)).toBeNull();
        expect(() => clearDraft("f1")).not.toThrow();
    });
});
