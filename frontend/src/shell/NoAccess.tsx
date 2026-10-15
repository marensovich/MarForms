import {useTranslation} from "react-i18next";
import {FiLock} from "react-icons/fi";
import {Link} from "react-router-dom";

/** A dashboard section opened without the permission it needs (403), instead of an empty page. */
export default function NoAccess() {
    const {t} = useTranslation();
    return (
        <div role="alert" className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 rounded-[20px] border border-bd bg-sf p-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-rdb text-rdt"><FiLock size={24} aria-hidden="true"/></span>
            <span className="rounded-full bg-rdb px-2.5 py-1 text-xs font-semibold text-rdt">403</span>
            <h1 className="m-0 text-[22px] font-bold text-tx">{t("shell.noAccessTitle")}</h1>
            <p className="m-0 text-[15px] leading-relaxed text-mu">{t("shell.noAccessText")}</p>
            <Link to="/dashboard/servers"
                  className="mt-2 inline-flex h-[38px] items-center rounded-[10px] border border-bd px-3.5 text-sm text-tx no-underline hover:bg-s2">
                {t("nav.servers")}
            </Link>
        </div>
    );
}
