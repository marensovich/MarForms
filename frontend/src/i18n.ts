import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import HttpBackend from "i18next-http-backend";
import {chosenLanguage, SUPPORTED_LANGUAGES} from "./languageChoice";

// Russian is the main language (ТЗ 8.3); the platform's settings give the
// default (LanguageLoader) and a user's own choice, once made, wins over it.

i18n.on("languageChanged", lng => {
    if (typeof document !== "undefined") document.documentElement.lang = lng;
});

i18n
    .use(HttpBackend)
    .use(initReactI18next)
    .init({
        lng: chosenLanguage() ?? "ru",
        fallbackLng: "ru",
        supportedLngs: SUPPORTED_LANGUAGES,
        ns: ["translation"],
        defaultNS: "translation",
        backend: {
            loadPath: "/locales/{{lng}}/{{ns}}.json",
        },
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
