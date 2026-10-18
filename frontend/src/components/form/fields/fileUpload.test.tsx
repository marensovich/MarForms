// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, describe, expect, it, vi} from "vitest";
import type {FormField} from "../../../types/forms";
import FileUploadField from "./FileUploadField";
import {UploadContext} from "./uploadContext";

const t = (key: string, o?: Record<string, unknown>) => (o && "name" in o ? `${key}:${o.name}` : key);
vi.mock("react-i18next", () => ({useTranslation: () => ({t, i18n: {language: "ru"}})}));
const upload = vi.fn();
vi.mock("../../../api/forms", () => ({uploadFormFile: (...a: unknown[]) => upload(...a)}));

const field: FormField = {id: "shots", type: "FILE_UPLOAD", label: "Скриншоты", required: false, maxFiles: 2,
    allowedExtensions: ["png"]};

describe("a file field taking several files", () => {
    afterEach(() => {
        cleanup();
        upload.mockReset();
    });

    it("uploads each file, answers with their ids and stops at the field's number", async () => {
        let n = 0;
        upload.mockImplementation((_s: string, _f: string, file: File) => ({
            promise: Promise.resolve({id: `id-${++n}`, fieldId: "shots", name: file.name, contentType: "image/png", size: 10}),
            abort: () => {},
        }));
        const onChange = vi.fn();
        const user = userEvent.setup();
        const {container} = render(
            <UploadContext.Provider value={{slug: "lspd", preview: false}}>
                <FileUploadField field={field} value={[]} onChange={onChange}/>
            </UploadContext.Provider>,
        );
        const input = container.querySelector("input[type=file]") as HTMLInputElement;
        expect(input.multiple).toBe(true);

        await user.upload(input, [new File(["a"], "a.png", {type: "image/png"}), new File(["b"], "b.png", {type: "image/png"})]);
        expect(await screen.findByText("b.png")).toBeTruthy();
        expect(onChange).toHaveBeenLastCalledWith(["id-1", "id-2"]);
        // Full: no drop zone until a file is removed.
        expect(screen.queryByText("form.file.drop")).toBeNull();

        await user.click(screen.getByRole("button", {name: "form.file.removeNamed:a.png"}));
        expect(onChange).toHaveBeenLastCalledWith(["id-2"]);
        expect(screen.getByText("form.file.drop")).toBeTruthy();
    });
});
