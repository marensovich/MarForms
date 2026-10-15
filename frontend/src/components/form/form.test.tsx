// @vitest-environment jsdom
import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "../../auth/AuthContextDefinition";
import type {FormDefinition, FormField} from "../../types/forms";
import FormRenderer from "./FormRenderer";
import {estimateMinutes, fillProgress, groupSections, isLongForm, layoutRows} from "./layout";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key, i18n: {language: "ru"}}),
}));
vi.mock("../../i18n", () => ({default: {t: (key: string) => key}}));
const submit = vi.fn();
vi.mock("../../api/forms", () => ({
    submitPublicForm: (...args: unknown[]) => submit(...args),
    submitForm: vi.fn(),
    uploadFormFile: vi.fn(),
}));
const resubmit = vi.fn();
vi.mock("../../api/moderation", () => ({
    resubmitMySubmission: (...args: unknown[]) => resubmit(...args),
}));

const f = (id: string, type: FormField["type"], extra: Partial<FormField> = {}): FormField =>
    ({id, type, label: id, required: false, ...extra} as FormField);

/** All 15 field types of ТЗ 3.4, two sections and a conditional field. */
const FIELDS: FormField[] = [
    f("s1", "SECTION_BREAK", {label: "О персонаже"}),
    f("name", "TEXT", {required: true}),
    f("age", "NUMBER", {required: true, min: 18}),
    f("email", "EMAIL"),
    f("phone", "PHONE"),
    f("forum", "URL"),
    f("bio", "TEXTAREA", {max: 2000}),
    f("s2", "SECTION_BREAK", {label: "Опыт"}),
    f("experienced", "BOOLEAN"),
    f("experience", "TEXTAREA", {required: true, condition: {fieldId: "experienced", operator: "EQUALS", value: "true"}}),
    f("department", "RADIO", {options: ["Патруль", "SWAT"]}),
    f("days", "CHECKBOX", {options: ["Будни", "Выходные"]}),
    f("rules", "SELECT", {options: ["Хорошо", "Плохо"]}),
    f("langs", "MULTI_SELECT", {options: ["Русский", "English"]}),
    f("date", "DATE"),
    f("time", "TIME"),
    f("when", "DATETIME"),
    f("rp", "RATING"),
    f("docs", "FILE_UPLOAD"),
];

const FORM = {
    id: "form-1", slug: "lspd", serverId: "0", channelsIds: [], webhooks: [], active: true, createdAt: "",
    accessMode: "AUTHENTICATED", schema: {title: "Набор в LSPD", description: "Академия", fields: FIELDS},
} as unknown as FormDefinition;

function show() {
    return render(
        <AuthContext.Provider value={{user: null, loading: false, login: async () => {}, logout: () => {}, banData: null}}>
            <MemoryRouter><FormRenderer form={FORM} meta={{guildName: "Los Santos RP", submissionLimitPerUser: 1}}/></MemoryRouter>
        </AuthContext.Provider>,
    );
}

describe("public form", () => {
    beforeEach(() => {
        const store: Record<string, string> = {};
        vi.stubGlobal("localStorage", {
            getItem: (k: string) => store[k] ?? null,
            setItem: (k: string, v: string) => { store[k] = v; },
            removeItem: (k: string) => { delete store[k]; },
        });
    });
    afterEach(() => {
        cleanup();
        submit.mockReset();
        vi.unstubAllGlobals();
    });

    it("renders every field type with its label tied to the control, in section cards", () => {
        show();
        for (const id of ["name", "age", "email", "phone", "forum", "bio", "rules", "date", "time", "when"]) {
            expect(screen.getByLabelText(new RegExp(`^${id}`))).toBeTruthy();
        }
        expect(screen.getByRole("switch", {name: /experienced/})).toBeTruthy();
        expect(screen.getByRole("group", {name: /department/})).toBeTruthy();
        expect(screen.getByRole("radiogroup", {name: "rp"})).toBeTruthy();
        expect(screen.getAllByRole("heading", {level: 2}).map(h => h.textContent)).toEqual(["О персонаже", "Опыт"]);
        expect(screen.queryByLabelText(/^experience\b/)).toBeNull();
    });

    it("validates on submit, focuses the first error and ties the message to the field", async () => {
        const user = userEvent.setup();
        show();
        await user.click(screen.getByRole("button", {name: "form.submit"}));
        const name = screen.getByLabelText(/^name/);
        expect(document.activeElement).toBe(name);
        expect(name.getAttribute("aria-invalid")).toBe("true");
        expect(document.getElementById(name.getAttribute("aria-describedby")!)?.textContent).toBe("form.validation.required");
        expect(screen.getByText("form.errorsToFix")).toBeTruthy();
        expect(submit).not.toHaveBeenCalled();
    });

    it("shows a conditional field right after its trigger, marked, and never sends a hidden one", async () => {
        const user = userEvent.setup();
        submit.mockResolvedValue({id: "1234567890", number: 1048, status: "PENDING", createdAt: "2026-10-15T14:02:00"});
        show();
        await user.type(screen.getByLabelText(/^name/), "Dmitry Volkov");
        await user.type(screen.getByLabelText(/^age/), "21");

        await user.click(screen.getByRole("switch", {name: /experienced/}));
        const experience = screen.getByLabelText(/^experience\*?$/);
        expect(within(experience.closest("div.bg-prs")! as HTMLElement).getByText("form.shownAfter")).toBeTruthy();
        await user.type(experience, "LSSD");

        await user.click(screen.getByRole("switch", {name: /experienced/}));
        expect(screen.queryByLabelText(/^experience\*?$/)).toBeNull();

        await user.click(screen.getByRole("button", {name: "form.submit"}));
        expect(submit).toHaveBeenCalledOnce();
        const sent = submit.mock.calls[0][1] as Record<string, unknown>;
        expect(sent).toMatchObject({name: "Dmitry Volkov", age: "21", experienced: false});
        expect(sent).not.toHaveProperty("experience");
        expect(await screen.findByText("form.success.title")).toBeTruthy();
        expect(screen.getByText(/№ 1048/)).toBeTruthy();
    });
});

describe("revising a submission", () => {
    afterEach(() => {
        cleanup();
        resubmit.mockReset();
        submit.mockReset();
    });

    it("opens with the earlier answers and the comment, and sends the same submission again", async () => {
        resubmit.mockResolvedValue({id: "s1", number: 7, status: "PENDING", createdAt: "2026-10-15T14:02:00"});
        const user = userEvent.setup();
        render(
            <AuthContext.Provider value={{user: null, loading: false, login: async () => {}, logout: () => {}, banData: null}}>
                <MemoryRouter>
                    <FormRenderer form={FORM} revision={{
                        submissionId: "s1", answers: {name: "Dmitry", age: "17"}, comment: "Укажите реальный возраст",
                        moderatorName: "Lena", files: {},
                    }}/>
                </MemoryRouter>
            </AuthContext.Provider>,
        );
        expect(screen.getByRole("note").textContent).toContain("Укажите реальный возраст");
        const age = screen.getByLabelText(/^age/) as HTMLInputElement;
        expect(age.value).toBe("17");
        await user.clear(age);
        await user.type(age, "21");
        await user.click(screen.getByRole("button", {name: "form.submit"}));
        expect(resubmit).toHaveBeenCalledWith("s1", expect.objectContaining({name: "Dmitry", age: "21"}));
        expect(submit).not.toHaveBeenCalled();
    });
});

describe("form layout rules", () => {
    it("groups by section breaks and pairs short unconditional fields", () => {
        const sections = groupSections(FIELDS);
        expect(sections.map(s => s.heading?.label)).toEqual(["О персонаже", "Опыт"]);
        const rows = layoutRows(sections[0].fields);
        expect(rows.map(r => r.kind === "pair" ? r.fields.map(x => x.id).join("+") : r.field.id))
            .toEqual(["name+age", "email+phone", "forum", "bio"]);
        expect(isLongForm(sections)).toBe(true);
    });

    it("counts progress over the shown fields and finds the current section", () => {
        const sections = groupSections(FIELDS);
        const visible = new Set(FIELDS.filter(x => x.id !== "experience").map(x => x.id));
        const p = fillProgress(sections, {name: "a", age: "20", email: "e@x", phone: "1", forum: "u", bio: "b"}, visible);
        expect(p).toEqual({section: 2, sections: 2, answered: 6, total: 16});
    });

    it("estimates the time from the field types", () => {
        expect(estimateMinutes([f("a", "TEXT")])).toBe(1);
        expect(estimateMinutes(FIELDS)).toBe(7);
    });
});
