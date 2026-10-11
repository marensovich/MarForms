import {describe, expect, it} from "vitest";
import type {FormField} from "../../types/forms";
import {conditionMatches, visibleFieldIds} from "./conditions";

const field = (id: string, condition?: FormField["condition"]): FormField =>
    ({id, type: "TEXT", label: id, required: false, condition} as FormField);

describe("conditions", () => {
    it("evaluates operators like the server (FormConditions)", () => {
        expect(conditionMatches({fieldId: "a", operator: "EQUALS", value: "yes"}, "yes")).toBe(true);
        expect(conditionMatches({fieldId: "a", operator: "NOT_EMPTY"}, "")).toBe(false);
        expect(conditionMatches({fieldId: "a", operator: "GREATER_THAN", value: "18"}, "21")).toBe(true);
        expect(conditionMatches({fieldId: "a", operator: "LESS_THAN", value: "18"}, "abc")).toBe(false);
    });

    it("hides a field whose controller is hidden, and survives loops", () => {
        const fields = [
            field("age"),
            field("adult", {fieldId: "age", operator: "GREATER_THAN", value: "17"}),
            field("licence", {fieldId: "adult", operator: "EQUALS", value: "yes"}),
            field("x", {fieldId: "y", operator: "NOT_EMPTY"}),
            field("y", {fieldId: "x", operator: "NOT_EMPTY"}),
        ];
        expect([...visibleFieldIds(fields, {age: "15", adult: "yes"})]).toEqual(["age"]);
        expect([...visibleFieldIds(fields, {age: "30", adult: "yes"})]).toEqual(["age", "adult", "licence"]);
    });
});
