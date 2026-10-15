import {useContext, useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiFile, FiUploadCloud, FiX} from "react-icons/fi";
import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";
import {type UploadedFile, uploadFormFile} from "../../../api/forms";
import {describeApiError} from "../../../api/errors";
import {cx} from "../../../ui";
import {allowedExtensions, formatBytes, sizeLimitMb} from "./fileRules";
import {fieldIds} from "./fieldStyles";
import {UploadContext} from "./uploadContext";

interface Props {
    field: FormField;
    value: string;
    onChange: (fileId: string) => void;
    onBlur?: () => void;
    error?: string;
}

/**
 * A file attachment (E3.2): a drop zone (drag and drop or "выберите"), the file
 * uploads as soon as it's chosen with a progress chip, then shows as a chip with
 * its size and a remove button (FormDesktop.dc.html — «Документы»). The field's
 * answer is the uploaded file's ID.
 */
export default function FileUploadField({field, value, onChange, onBlur, error}: Props) {
    const {t} = useTranslation();
    const {slug, preview, knownFiles} = useContext(UploadContext);
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<(() => void) | null>(null);
    // A revised submission's file is shown as already there (#119).
    const [uploaded, setUploaded] = useState<UploadedFile | null>(() => (value && knownFiles?.[value]) || null);
    const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);

    const extensions = allowedExtensions(field);
    const limitMb = sizeLimitMb(field);
    const disabled = preview || !slug;

    useEffect(() => () => abortRef.current?.(), []);

    const choose = (file: File | undefined) => {
        if (!file || !slug) return;
        const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
        if (!extensions.includes(ext)) {
            setUploadError(t("form.file.wrongType", {types: extensions.join(", ")}));
            return;
        }
        if (file.size > limitMb * 1024 * 1024) {
            setUploadError(t("form.file.tooLarge", {max: limitMb}));
            return;
        }
        abortRef.current?.();
        setUploadError(null);
        setUploaded(null);
        onChange("");
        setUploading({name: file.name, progress: 0});
        const {promise, abort} = uploadFormFile(slug, field.id, file, p => setUploading({name: file.name, progress: p}));
        abortRef.current = abort;
        promise
            .then(result => {
                setUploaded(result);
                onChange(result.id);
                onBlur?.();
            })
            .catch(e => {
                if (e instanceof DOMException && e.name === "AbortError") return;
                setUploadError(describeApiError(e, t("form.file.failed")));
            })
            .finally(() => {
                setUploading(null);
                abortRef.current = null;
            });
    };

    const clear = () => {
        abortRef.current?.();
        setUploaded(null);
        setUploading(null);
        setUploadError(null);
        onChange("");
        if (inputRef.current) inputRef.current.value = "";
    };

    const shownError = uploadError ?? error;
    const limits = t("form.file.limits", {types: extensions.map(e => e.toUpperCase()).join(", "), max: limitMb});

    return (
        <FieldWrapper fieldId={field.id} label={field.label} required={field.required} description={field.description} error={shownError}>
            <input ref={inputRef} id={fieldIds(field.id).input} type="file" className="sr-only" tabIndex={-1} aria-hidden="true"
                   accept={extensions.map(e => `.${e}`).join(",")} onChange={e => choose(e.target.files?.[0])}/>
            {!(value && uploaded) && !uploading && (
                <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}
                        onDragOver={e => {
                            if (disabled) return;
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => {
                            e.preventDefault();
                            setDragOver(false);
                            if (!disabled) choose(e.dataTransfer.files?.[0]);
                        }}
                        aria-describedby={shownError ? fieldIds(field.id).error : undefined}
                        className={cx("flex w-full flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed p-7 text-center transition-colors",
                            "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs disabled:cursor-not-allowed disabled:opacity-60",
                            shownError ? "border-dg bg-rdb" : dragOver ? "border-pr bg-prs" : "border-pr bg-prs hover:bg-prs/70")}>
                    <FiUploadCloud size={22} className="text-prt" aria-hidden="true"/>
                    <span className="text-sm font-semibold text-tx">
                        {preview ? t("form.file.previewDisabled") : <>{t("form.file.drop")} <span className="text-prt underline">{t("form.file.choose")}</span></>}
                    </span>
                    <span className="text-xs text-mu">{limits}</span>
                </button>
            )}
            {(uploading || (value && uploaded)) && (
                <div className="flex flex-wrap gap-2">
                    {value && uploaded && (
                        <span className="flex items-center gap-2.5 rounded-[10px] border border-bd px-2.5 py-2 text-[13px] text-tx">
                            <FiFile size={15} className="text-mu" aria-hidden="true"/>
                            <span className="max-w-[240px] truncate">{uploaded.name}</span>
                            <span className="text-mu">{formatBytes(uploaded.size)}</span>
                            <button type="button" onClick={clear} aria-label={t("form.file.remove")}
                                    className="grid h-6 w-6 place-items-center rounded text-mu hover:text-tx focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr">
                                <FiX size={14} aria-hidden="true"/>
                            </button>
                        </span>
                    )}
                    {uploading && (
                        <span className="flex w-[220px] flex-col gap-1.5 rounded-[10px] border border-bd px-2.5 py-2 text-[13px] text-tx" aria-live="polite">
                            <span className="flex justify-between gap-2">
                                <span className="truncate">{uploading.name}</span>
                                <span className="tabular-nums text-mu">{Math.round(uploading.progress * 100)}%</span>
                            </span>
                            <span className="h-1 overflow-hidden rounded-full bg-s2">
                                <span className="block h-full bg-pr transition-all" style={{width: `${Math.round(uploading.progress * 100)}%`}}/>
                            </span>
                            <button type="button" onClick={clear} className="self-start text-xs text-mu hover:text-tx">{t("common.cancel")}</button>
                        </span>
                    )}
                </div>
            )}
        </FieldWrapper>
    );
}
