import {useContext, useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiFile, FiUploadCloud, FiX} from "react-icons/fi";
import FieldWrapper from "./FieldWrapper";
import type {FormField} from "../../../types/forms";
import {type UploadedFile, uploadFormFile} from "../../../api/forms";
import {describeApiError} from "../../../api/errors";
import {cx} from "../../../ui";
import {allowedExtensions, formatBytes, maxFiles, sizeLimitMb} from "./fileRules";
import {fieldIds} from "./fieldStyles";
import {UploadContext} from "./uploadContext";

interface Props {
    field: FormField;
    /** One file's ID, or several (a field taking more than one file). */
    value: string | string[];
    onChange: (value: string | string[]) => void;
    onBlur?: () => void;
    error?: string;
}

interface Uploading {
    key: number;
    name: string;
    progress: number;
    abort: () => void;
}

const idsOf = (value: string | string[]) => (Array.isArray(value) ? value : value ? [value] : []);

/**
 * A file attachment (E3.2, ТЗ 3.4): a drop zone (drag and drop or "выберите");
 * each file uploads as soon as it's chosen with a progress chip, then shows as a
 * chip with its size and a remove button (FormDesktop.dc.html — «Документы»).
 * The answer is the uploaded file's ID — or the IDs, when the field takes
 * several files (up to its maxFiles).
 */
export default function FileUploadField({field, value, onChange, onBlur, error}: Props) {
    const {t} = useTranslation();
    const {slug, preview, knownFiles} = useContext(UploadContext);
    const inputRef = useRef<HTMLInputElement>(null);
    const most = maxFiles(field);
    // A revised submission's files are shown as already there (#119).
    const [uploaded, setUploaded] = useState<UploadedFile[]>(() =>
        idsOf(value).map(id => knownFiles?.[id]).filter((f): f is UploadedFile => !!f));
    const [uploading, setUploading] = useState<Uploading[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const nextKey = useRef(0);
    const uploadingRef = useRef(uploading);
    useEffect(() => {
        uploadingRef.current = uploading;
    });
    useEffect(() => () => uploadingRef.current.forEach(u => u.abort()), []);

    const extensions = allowedExtensions(field);
    const limitMb = sizeLimitMb(field);
    const disabled = preview || !slug;
    const room = most - uploaded.length - uploading.length;

    const emit = (files: UploadedFile[]) => onChange(most === 1 ? (files[0]?.id ?? "") : files.map(f => f.id));

    const choose = (list: FileList | null | undefined) => {
        if (!list || !slug) return;
        const chosen = Array.from(list);
        if (chosen.length > room) {
            setUploadError(t("form.file.tooMany", {count: most}));
            return;
        }
        for (const file of chosen) {
            const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
            if (!extensions.includes(ext)) {
                setUploadError(t("form.file.wrongType", {types: extensions.join(", ")}));
                return;
            }
            if (file.size > limitMb * 1024 * 1024) {
                setUploadError(t("form.file.tooLarge", {max: limitMb}));
                return;
            }
        }
        setUploadError(null);
        for (const file of chosen) {
            const key = nextKey.current++;
            const {promise, abort} = uploadFormFile(slug, field.id, file,
                p => setUploading(list => list.map(u => u.key === key ? {...u, progress: p} : u)));
            setUploading(list => [...list, {key, name: file.name, progress: 0, abort}]);
            promise
                .then(result => setUploaded(files => {
                    const next = [...files, result];
                    emit(next);
                    onBlur?.();
                    return next;
                }))
                .catch(e => {
                    if (e instanceof DOMException && e.name === "AbortError") return;
                    setUploadError(describeApiError(e, t("form.file.failed")));
                })
                .finally(() => setUploading(list => list.filter(u => u.key !== key)));
        }
        if (inputRef.current) inputRef.current.value = "";
    };

    const remove = (id: string) => {
        const next = uploaded.filter(f => f.id !== id);
        setUploaded(next);
        setUploadError(null);
        emit(next);
    };

    const shownError = uploadError ?? error;
    const limits = t(most > 1 ? "form.file.limitsMany" : "form.file.limits",
        {types: extensions.map(e => e.toUpperCase()).join(", "), max: limitMb, count: most});

    return (
        <FieldWrapper fieldId={field.id} label={field.label} required={field.required} description={field.description} error={shownError}>
            <input ref={inputRef} id={fieldIds(field.id).input} type="file" className="sr-only" tabIndex={-1} aria-hidden="true"
                   multiple={most > 1} accept={extensions.map(e => `.${e}`).join(",")} onChange={e => choose(e.target.files)}/>
            {room > 0 && (
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
                            if (!disabled) choose(e.dataTransfer.files);
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
            {(uploading.length > 0 || uploaded.length > 0) && (
                <div className="flex flex-wrap gap-2">
                    {uploaded.map(f => (
                        <span key={f.id} className="flex items-center gap-2.5 rounded-[10px] border border-bd px-2.5 py-2 text-[13px] text-tx">
                            <FiFile size={15} className="text-mu" aria-hidden="true"/>
                            <span className="max-w-[240px] truncate">{f.name}</span>
                            <span className="text-mu">{formatBytes(f.size)}</span>
                            <button type="button" onClick={() => remove(f.id)} aria-label={t("form.file.removeNamed", {name: f.name})}
                                    className="mf-hit grid h-6 w-6 place-items-center rounded text-mu hover:text-tx focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr">
                                <FiX size={14} aria-hidden="true"/>
                            </button>
                        </span>
                    ))}
                    {uploading.map(u => (
                        <span key={u.key} className="flex w-[220px] flex-col gap-1.5 rounded-[10px] border border-bd px-2.5 py-2 text-[13px] text-tx" aria-live="polite">
                            <span className="flex justify-between gap-2">
                                <span className="truncate">{u.name}</span>
                                <span className="tabular-nums text-mu">{Math.round(u.progress * 100)}%</span>
                            </span>
                            <span className="h-1 overflow-hidden rounded-full bg-s2">
                                <span className="block h-full bg-pr transition-all" style={{width: `${Math.round(u.progress * 100)}%`}}/>
                            </span>
                            <button type="button" onClick={u.abort} className="self-start text-xs text-mu hover:text-tx">{t("common.cancel")}</button>
                        </span>
                    ))}
                </div>
            )}
        </FieldWrapper>
    );
}
