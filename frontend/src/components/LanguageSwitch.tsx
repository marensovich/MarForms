import {useTranslation} from "react-i18next";
import {cx} from "../ui";
import {rememberLanguage} from "../languageChoice";

/** RU · EN switch of the public pages (landing, sign-in). */
export default function LanguageSwitch() {
    const {t, i18n} = useTranslation();
    const lang = i18n.language?.startsWith("en") ? "en" : "ru";
    return (
        <div role="radiogroup" aria-label={t("shell.language")}
             className="flex rounded-[9px] border border-bd p-0.5 text-xs font-semibold">
            {(["ru", "en"] as const).map(code => (
                <button key={code} type="button" role="radio" aria-checked={lang === code}
                        onClick={() => {
                            rememberLanguage(code);
                            i18n.changeLanguage(code);
                        }}
                        className={cx("h-[26px] rounded-[7px] px-2 uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr",
                            lang === code ? "bg-prs text-prt" : "text-mu hover:text-tx")}>
                    {code}
                </button>
            ))}
        </div>
    );
}
