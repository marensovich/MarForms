import {useState} from "react";
import {useTranslation} from "react-i18next";
import type {FormField} from "../../../types/forms";
import {DEFAULT_FILE_EXTENSIONS, DEFAULT_FILE_SIZE_MB, MAX_FILE_SIZE_MB} from "../../form/fields/fileRules";

const inputCls = "w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-sm text-[#1E1E24] outline-none placeholder:text-[#C7C7CE] focus:border-[#3730A3]";

function parseExtensions(raw: string): string[] {
    return [...new Set(raw.split(/[\s,;]+/)
        .map(e => e.trim().toLowerCase().replace(/^\./, ""))
        .filter(e => e !== ""))];
}

/** Limits of a FILE_UPLOAD field (task #84); the server re-checks them. */
export default function FileFieldSettings({field, onUpdate}: {
    field: FormField;
    onUpdate: (patch: Partial<FormField>) => void;
}) {
    const {t} = useTranslation();
    // Free text while typing; parsed into the list on every change.
    const [extensions, setExtensions] = useState((field.allowedExtensions ?? []).join(", "));

    return (
        <div className="space-y-3">
            <div>
                <p className="mb-1.5 text-xs font-medium text-[#6B6B76]">{t("wizard.fields.file.extensions")}</p>
                <input
                    value={extensions}
                    onChange={e => {
                        setExtensions(e.target.value);
                        const list = parseExtensions(e.target.value);
                        onUpdate({allowedExtensions: list.length ? list : undefined});
                    }}
                    placeholder={DEFAULT_FILE_EXTENSIONS.join(", ")}
                    className={inputCls}
                />
                <p className="mt-1 text-[11px] text-[#8B8B96]">{t("wizard.fields.file.extensionsHint")}</p>
            </div>
            <div>
                <p className="mb-1.5 text-xs font-medium text-[#6B6B76]">
                    {t("wizard.fields.file.maxSize", {max: MAX_FILE_SIZE_MB})}
                </p>
                <input
                    type="number"
                    min={1}
                    max={MAX_FILE_SIZE_MB}
                    value={field.maxFileSizeMb ?? ""}
                    onChange={e => onUpdate({maxFileSizeMb: e.target.value ? Number(e.target.value) : undefined})}
                    placeholder={String(DEFAULT_FILE_SIZE_MB)}
                    className={inputCls}
                />
            </div>
        </div>
    );
}
