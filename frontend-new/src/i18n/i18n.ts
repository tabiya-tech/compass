import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "../locales/en-us/translation.json";
import es from "../locales/es-es/translation.json";
import ar from "../locales/es-ar/translation.json";
import fr from "../locales/fr-fr/translation.json";
import { DEFAULT_LOCALE } from "./constants";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "en-US": {
        translation: en,
      },
      "en-GB": {
        translation: en,
      },
      // Support lowercase variant to be lenient with detectors/storage
      "en-gb": {
        translation: en,
      },
      "es-AR": {
        translation: ar,
      },
      "es-ES": {
        translation: es,
      },
      // Support lowercase variant
      "es-es": {
        translation: es,
      },
      "fr-FR": {
        translation: fr,
      },
      "fr-fr": {
        translation: fr,
      },
    },
  fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;

// Normalize legacy saved language codes (e.g., in localStorage) to new standardized ones
try {
  const current = i18n.language;
  if (current === 'en') {
    i18n.changeLanguage(DEFAULT_LOCALE);
  } else if (current === 'es') {
    i18n.changeLanguage('es-es');
  }
} catch {
  // no-op
}
