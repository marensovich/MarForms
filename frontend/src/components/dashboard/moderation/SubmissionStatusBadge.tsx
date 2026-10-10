import {useTranslation} from "react-i18next";
import type {SubmissionStatus} from "../../../api/moderation";
import {Badge} from "../shared";

const COLOR: Record<SubmissionStatus, "default" | "green" | "orange" | "red"> = {
    PENDING: "default",
    APPROVED: "green",
    NEEDS_REVISION: "orange",
    REJECTED: "red",
};

export function SubmissionStatusBadge({status}: { status: SubmissionStatus }) {
    const {t} = useTranslation();
    return <Badge color={COLOR[status]} dot>{t(`moderation.status.${status}`)}</Badge>;
}
