import type {ReactNode} from "react";
import {useEffect} from "react";
import i18n from "../i18n";
import {fetchPublicSettings} from "../api/settings";
import {chosenLanguage} from "../languageChoice";

export default function LanguageLoader({children}: { children: ReactNode }) {
    useEffect(() => {
        // The platform's default (ТЗ 8.3) applies until the user picks a language.
        if (chosenLanguage()) return;
        fetchPublicSettings()
            .then(s => {
                const lang = s.uiLanguage === "en" ? "en" : "ru";
                if (i18n.language !== lang) i18n.changeLanguage(lang);
            })
            .catch(() => {/* keep Russian */});
    }, []);

    return <>{children}</>;
}
