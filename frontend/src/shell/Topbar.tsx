import {Fragment} from "react";
import {useTranslation} from "react-i18next";
import {FiChevronRight, FiSearch} from "react-icons/fi";
import {Link} from "react-router-dom";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";

export interface Crumb {
    label: string;
    to?: string;
}

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

// Docs: docs/design/mockups/Topbar.dc.html.
export default function Topbar({crumbs, onSearch}: { crumbs: Crumb[]; onSearch: () => void }) {
    const {t} = useTranslation();
    return (
        <header className="sticky top-0 z-30 flex h-[60px] flex-none items-center gap-4 border-b border-bd bg-sf pl-10 pr-6 text-tx">
            <nav aria-label={t("shell.breadcrumbs")} className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-[13px] text-mu">
                <ol className="m-0 flex list-none items-center gap-1.5 p-0">
                    {crumbs.map((c, i) => {
                        const last = i === crumbs.length - 1;
                        return (
                            <Fragment key={`${c.label}-${i}`}>
                                {i > 0 && <FiChevronRight size={14} aria-hidden="true" className="flex-none"/>}
                                <li className="min-w-0 truncate">
                                    {last || !c.to
                                        ? <span aria-current={last ? "page" : undefined} className={last ? "font-semibold text-tx" : undefined}>{c.label}</span>
                                        : <Link to={c.to} className="text-mu no-underline hover:text-tx">{c.label}</Link>}
                                </li>
                            </Fragment>
                        );
                    })}
                </ol>
            </nav>
            <button type="button" onClick={onSearch} aria-keyshortcuts={IS_MAC ? "Meta+K" : "Control+K"}
                    className="flex h-9 w-[300px] max-w-[40%] items-center gap-2 rounded-[10px] border border-bd bg-bg px-2.5 text-left text-[13px] text-mu hover:border-mu/40 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs">
                <FiSearch size={15} aria-hidden="true" className="flex-none"/>
                <span className="flex-1 truncate">{t("palette.placeholder")}</span>
                <kbd className="rounded-md border border-bd bg-sf px-1.5 py-0.5 font-mono text-[11px]">{IS_MAC ? "⌘K" : "Ctrl K"}</kbd>
            </button>
            <NotificationBell/>
            <UserMenu variant="topbar"/>
        </header>
    );
}
