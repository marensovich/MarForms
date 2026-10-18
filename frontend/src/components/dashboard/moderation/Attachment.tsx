import {useState} from "react";
import {useTranslation} from "react-i18next";
import {FiFile, FiImage} from "react-icons/fi";
import {downloadSubmissionFile, type SubmissionFile} from "../../../api/moderation";
import {cx, Spinner} from "../../../ui";
import {formatBytes} from "../../form/fields/fileRules";

/** A file chip: name and size; a click downloads it. */
export default function Attachment({file}: { file: SubmissionFile }) {
    const {t} = useTranslation();
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const Icon = file.contentType?.startsWith("image/") ? FiImage : FiFile;
    return (
        <button type="button" disabled={busy} title={t("moderation.card.download")}
                onClick={() => {
                    setBusy(true);
                    setFailed(false);
                    downloadSubmissionFile(file).catch(() => setFailed(true)).finally(() => setBusy(false));
                }}
                className={cx("flex h-10 items-center gap-2 rounded-[10px] border px-3 text-[13px] text-tx hover:bg-s2 disabled:opacity-60",
                    failed ? "border-rdt" : "border-bd")}>
            {busy ? <Spinner/> : <Icon size={16} aria-hidden="true" className="text-mu"/>}
            {file.name}
            <span className="text-mu">{failed ? t("moderation.card.downloadFailed") : formatBytes(file.size)}</span>
        </button>
    );
}
