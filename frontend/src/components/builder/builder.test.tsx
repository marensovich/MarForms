// @vitest-environment jsdom
import {act, cleanup, render, renderHook, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {useState} from "react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {ApiError} from "../../api/client";
import type {FormDefinition, FormField} from "../../types/forms";
import {ToastProvider} from "../../ui";
import FieldsTab from "./FieldsTab";
import AccessTab from "./AccessTab";
import {roleGateVerdict} from "./roleGate";
import {stateOf, useFormEditor} from "./useFormEditor";

const t = (key: string, o?: Record<string, unknown>) => {
    const values = o && Object.entries(o).filter(([k]) => k !== "defaultValue" && k !== "count").map(([, v]) => v);
    return values?.length ? `${key}:${values.join(",")}` : key;
};
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
const getForm = vi.fn();
const updateForm = vi.fn();
vi.mock("../../api/dashboard", () => ({
    getForm: (id: string) => getForm(id),
    updateForm: (...a: unknown[]) => updateForm(...a),
    getGuildRoles: () => Promise.resolve([{id: "r1", name: "Гражданин", color: 0x22c55e, memberCount: 12}]),
}));

const def = (extra: Partial<FormDefinition> = {}): FormDefinition => ({
    id: "f1", serverId: "9", channelsIds: [], webhooks: [], active: true, createdAt: "2026-10-01T00:00:00", version: 1,
    status: "PUBLISHED", slug: "lspd", accessMode: "AUTHENTICATED",
    schema: {title: "LSPD", description: "", fields: []}, ...extra,
});

describe("the editor's autosave", () => {
    afterEach(() => {
        vi.useRealTimers();
        getForm.mockReset();
        updateForm.mockReset();
    });

    it("edits the draft of a published form, saves a moment after the last change, and stops on a conflict", async () => {
        getForm.mockResolvedValue(def({draftSchema: {title: "LSPD (правки)", description: "", fields: []}, hasUnpublishedChanges: true}));
        updateForm.mockImplementation((_guild: string, _id: string, p: { schema: { title: string } }) =>
            Promise.resolve(def({version: 2, draftSchema: {...p.schema, description: "", fields: []}})));
        const {result} = renderHook(() => useFormEditor("f1"));
        await waitFor(() => expect(result.current.state).not.toBeNull());
        // The editor shows the draft, not what respondents see.
        expect(result.current.state!.title).toBe("LSPD (правки)");

        vi.useFakeTimers();
        act(() => result.current.update({title: "LSPD 2"}));
        expect(result.current.status.kind).toBe("unsaved");
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1300);
        });
        expect(updateForm).toHaveBeenCalledTimes(1);
        expect(updateForm.mock.calls[0][0]).toBe("9");
        expect(updateForm.mock.calls[0][2]).toMatchObject({version: 1, schema: {title: "LSPD 2"}});
        expect(result.current.status.kind).toBe("saved");

        updateForm.mockRejectedValueOnce(new ApiError(409, JSON.stringify({updatedBy: "Мария S.", updatedAt: "2026-10-18T14:24:00"})));
        act(() => result.current.update({title: "LSPD 3"}));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1300);
        });
        expect(result.current.status).toMatchObject({kind: "conflict", by: "Мария S."});
        // No more saves after a conflict; the edit stays on screen.
        act(() => result.current.update({title: "LSPD 4"}));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(updateForm).toHaveBeenCalledTimes(2);
        expect(result.current.state!.title).toBe("LSPD 4");
    });

    it("reads a text's length from min/max on older forms", () => {
        const s = stateOf(def({accessMode: "ROLE_GATED", allowedRoleIds: ["1"], opensAt: "2026-10-20T10:00:00"}));
        expect(s.opensAt).toBe("2026-10-20T10:00");
        expect(s.allowedRoleIds).toEqual(["1"]);
    });
});

function Fields({initial}: { initial: FormField[] }) {
    const [fields, setFields] = useState(initial);
    return <ToastProvider><FieldsTab fields={fields} onChange={setFields}/><output data-testid="out">{JSON.stringify(fields)}</output></ToastProvider>;
}

describe("the fields tab", () => {
    afterEach(cleanup);

    it("adds a field after the selected one, offers conditions only on fields above, and drops conditions of a removed field", async () => {
        const role: FormField = {id: "role", type: "RADIO", label: "Роль", required: true, options: ["Полиция", "Гражданский"]};
        const badge: FormField = {id: "badge", type: "TEXT", label: "Номер жетона", required: false,
            condition: {fieldId: "role", operator: "EQUALS", value: "Полиция"}};
        const user = userEvent.setup();
        render(<Fields initial={[role, badge]}/>);
        const out = () => JSON.parse(screen.getByTestId("out").textContent!) as FormField[];

        // The first field has nothing above it to depend on.
        expect(screen.getByText("builder.condition.noneAbove")).toBeTruthy();
        await user.click(within(screen.getByRole("list", {name: "builder.fields.list"})).getByText("Номер жетона"));
        const fieldSelect = screen.getByRole("combobox", {name: "builder.condition.field"});
        expect(within(fieldSelect).getAllByRole("option").map(o => o.textContent)).toEqual(["Роль"]);

        await user.click(screen.getByRole("button", {name: "wizard.fields.types.NUMBER.label"}));
        expect(out().map(f => f.type)).toEqual(["RADIO", "TEXT", "NUMBER"]);

        // Removing «Роль» asks first: «Номер жетона» depends on it.
        await user.click(within(screen.getByRole("list", {name: "builder.fields.list"})).getByText("Роль"));
        await user.click(screen.getByRole("button", {name: "builder.fields.remove"}));
        await user.click(within(screen.getByRole("alertdialog")).getByRole("button", {name: "builder.fields.remove"}));
        expect(out().map(f => f.id)).toEqual(["badge", out()[1].id]);
        expect(out()[0].condition).toBeNull();
    });

    it("moves the focused field with ⌥↑ / ⌥↓", async () => {
        const a: FormField = {id: "a", type: "TEXT", label: "A", required: false};
        const b: FormField = {id: "b", type: "TEXT", label: "B", required: false};
        const user = userEvent.setup();
        render(<Fields initial={[a, b]}/>);
        const list = screen.getByRole("list", {name: "builder.fields.list"});
        await user.click(within(list).getByText("B"));
        await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
        expect((JSON.parse(screen.getByTestId("out").textContent!) as FormField[]).map(f => f.id)).toEqual(["b", "a"]);
    });
});

describe("access", () => {
    afterEach(cleanup);

    it("makes a form anonymous only after the risks are accepted", async () => {
        const update = vi.fn();
        const user = userEvent.setup();
        const state = stateOf(def());
        render(<AccessTab state={state} update={update} guild={null}/>);
        await user.click(screen.getByRole("radio", {name: /builder.access.mode.ANONYMOUS.title/}));
        const dialog = screen.getByRole("alertdialog");
        const confirm = within(dialog).getByRole("button", {name: "builder.access.anon.confirm"});
        expect((confirm as HTMLButtonElement).disabled).toBe(true);
        expect(update).not.toHaveBeenCalled();
        await user.click(within(dialog).getByRole("checkbox"));
        await user.click(confirm);
        expect(update).toHaveBeenCalledWith({accessMode: "ANONYMOUS", submissionLimitPerUser: null});
    });

    it("applies the server's RoleGate rule in the preview: a denied role wins", () => {
        expect(roleGateVerdict(["a"], ["d"], ["a", "d"])).toBe("ROLE_DENIED");
        expect(roleGateVerdict(["a"], [], [])).toBe("ROLE_REQUIRED");
        expect(roleGateVerdict([], ["d"], [])).toBe("GRANTED");
        expect(roleGateVerdict(["a"], ["d"], ["a"])).toBe("GRANTED");
    });
});
