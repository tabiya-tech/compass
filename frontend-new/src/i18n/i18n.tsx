import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: '/locales/languages/{{lng}}.json',
    },
    fallbackLng: Language.en,
    debug: true,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
