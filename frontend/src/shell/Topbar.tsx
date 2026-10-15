import {Fragment} from "react";
import {useTranslation} from "react-i18next";
import {FiChevronRight} from "react-icons/fi";
import {Link} from "react-router-dom";
import UserMenu from "./UserMenu";

export interface Crumb {
    label: string;
    to?: string;
}

// Docs: docs/design/mockups/Topbar.dc.html. Search (⌘K, #107) and notifications (#123) join here.
export default function Topbar({crumbs}: { crumbs: Crumb[] }) {
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
            <UserMenu variant="topbar"/>
        </header>
    );
}
