import {useTranslation} from "react-i18next";
import type {IconType} from "react-icons";
import {FiCheck, FiClock, FiEdit2, FiSend, FiX} from "react-icons/fi";
import type {SubmissionStatus} from "../../../api/moderation";
import {cx} from "../../../ui";

// Docs: docs/design/mockups/WsSubmissions.dc.html; ТЗ ФТ-3.6.3 colours.

const STYLE: Record<SubmissionStatus, { cls: string; icon: IconType }> = {
    PENDING: {cls: "bg-amb text-amt", icon: FiClock},
    APPROVED: {cls: "bg-gnb text-gnt", icon: FiCheck},
    REJECTED: {cls: "bg-rdb text-rdt", icon: FiX},
    NEEDS_REVISION: {cls: "bg-prs text-prt", icon: FiEdit2},
    RECEIVED: {cls: "bg-inb text-int", icon: FiSend},
};

export function SubmissionStatusBadge({status}: { status: SubmissionStatus }) {
    const {t} = useTranslation();
    const {cls, icon: Icon} = STYLE[status];
    return (
        <span className={cx("inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", cls)}>
            <Icon size={12} strokeWidth={2.4} aria-hidden="true"/>{t(`moderation.status.${status}`)}
        </span>
    );
}
