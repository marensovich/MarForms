import type {ReactNode} from "react";
import {useEffect} from "react";
import i18n from "../i18n";
import {fetchPublicSettings} from "../api/settings";

export default function LanguageLoader({children}: { children: ReactNode }) {
    useEffect(() => {
        fetchPublicSettings()
            .then(s => {
                const lang = s.uiLanguage ?? "en";
                if (i18n.language !== lang) i18n.changeLanguage(lang);
            })
            .catch(() => {/* keep default "en" */});
    }, []);

    return <>{children}</>;
}
