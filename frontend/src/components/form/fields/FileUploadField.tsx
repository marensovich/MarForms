import {useContext, useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiFile, FiPaperclip, FiX} from "react-icons/fi";
import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";
import {type UploadedFile, uploadFormFile} from "../../../api/forms";
import {describeApiError} from "../../../api/errors";
import {allowedExtensions, formatBytes, sizeLimitMb} from "./fileRules";
import {UploadContext} from "./uploadContext";

interface Props {
    field: FormField;
    value: string;
    onChange: (fileId: string) => void;
    onBlur?: () => void;
    error?: string;
}

/**
 * A file attachment (E3.2): the file is uploaded as soon as it's chosen,
 * with progress, and the field's answer becomes the uploaded file's ID. The
 * rest of the form stays usable while it uploads.
 */
export default function FileUploadField({field, value, onChange, onBlur, error}: Props) {
    const {t} = useTranslation();
    const {slug, preview} = useContext(UploadContext);
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<(() => void) | null>(null);
    const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const extensions = allowedExtensions(field);
    const limitMb = sizeLimitMb(field);

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
        setProgress(0);
        const {promise, abort} = uploadFormFile(slug, field.id, file, setProgress);
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
                setProgress(null);
                abortRef.current = null;
            });
    };

    const clear = () => {
        abortRef.current?.();
        setUploaded(null);
        setProgress(null);
        setUploadError(null);
        onChange("");
        if (inputRef.current) inputRef.current.value = "";
    };

    const disabled = preview || !slug;
    const shownError = uploadError ?? error;

    return (
        <FieldWrapper label={field.label} required={field.required} description={field.description} error={shownError}>
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={extensions.map(e => `.${e}`).join(",")}
                onChange={e => choose(e.target.files?.[0])}
            />
            {value && uploaded ? (
                <div className="flex items-center gap-3 rounded-xl border border-gnb bg-gnb px-3 py-2.5">
                    <FiFile size={16} className="flex-shrink-0 text-gnt"/>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-tx">{uploaded.name}</p>
                        <p className="text-xs text-mu">{formatBytes(uploaded.size)}</p>
                    </div>
                    <button type="button" onClick={clear} aria-label={t("form.file.remove")}
                            className="rounded-lg p-1 text-mu transition-colors hover:bg-sf hover:text-tx">
                        <FiX size={14}/>
                    </button>
                </div>
            ) : progress !== null ? (
                <div className="rounded-xl border border-bd bg-sf px-3 py-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-mu">
                        <span>{t("form.file.uploading")}</span>
                        <span className="tabular-nums">{Math.round(progress * 100)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-s2">
                        <div className="h-full rounded-full bg-pr transition-all"
                             style={{width: `${Math.round(progress * 100)}%`}}/>
                    </div>
                    <button type="button" onClick={clear} className="mt-1.5 text-xs text-mu hover:text-tx">
                        {t("common.cancel")}
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => inputRef.current?.click()}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        shownError
                            ? "border-rdb bg-rdb text-rdt"
                            : "border-bd bg-sf text-mu hover:border-pr hover:text-prt"
                    }`}
                >
                    <FiPaperclip size={15}/>
                    {preview ? t("form.file.previewDisabled") : t("form.file.choose")}
                </button>
            )}
            <p className="text-[11px] text-mu">
                {t("form.file.limits", {types: extensions.join(", "), max: limitMb})}
            </p>
        </FieldWrapper>
    );
}
