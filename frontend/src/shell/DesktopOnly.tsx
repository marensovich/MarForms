import {useTranslation} from "react-i18next";
import {FiMonitor} from "react-icons/fi";

/**
 * «Откройте на компьютере» (ТЗ 4.10): the form builder and the platform
 * administration aren't made for a phone.
 */
export default function DesktopOnly({onBack}: { onBack?: () => void }) {
    const {t} = useTranslation();
    return (
        <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-bd bg-sf px-6 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-prs text-prt"><FiMonitor size={24} aria-hidden="true"/></span>
            <h2 className="m-0 text-lg font-bold">{t("shell.desktopOnly.title")}</h2>
            <p className="m-0 max-w-[320px] text-sm leading-normal text-mu">{t("shell.desktopOnly.text")}</p>
            {onBack && (
                <button type="button" onClick={onBack}
                        className="mt-1 h-11 rounded-xl border border-bd bg-sf px-4 text-sm font-semibold text-tx hover:bg-s2">
                    {t("shell.desktopOnly.back")}
                </button>
            )}
        </div>
    );
}
