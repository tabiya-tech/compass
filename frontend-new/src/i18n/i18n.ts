import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "../locales/en-us/translation.json";
import es from "../locales/es/translation.json";
import ar from "../locales/es-ar/translation.json";
import fr from "../locales/fr-fr/translation.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "en-US": {
        translation: en,
      },
      "en": {
        translation: en,
      },
      "es-AR": {
        translation: ar,
      },
      "es": {
        translation: es,
      },
      "fr-FR": {
        translation: fr,
      },
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
