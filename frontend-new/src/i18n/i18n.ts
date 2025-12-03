import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { Locale } from "./constants";

// --- Import translations ---
import enGb from "./locales/en-GB/translation.json";
import enUs from "./locales/en-US/translation.json";
import esEs from "./locales/es-ES/translation.json";
import esAr from "./locales/es-AR/translation.json";

// --- Import feedback questions ---
import questionsEnGb from "src/feedback/overallFeedback/feedbackForm/questions-en-gb.json";
import questionsEnUs from "src/feedback/overallFeedback/feedbackForm/questions-en-us.json";
import questionsEsEs from "src/feedback/overallFeedback/feedbackForm/questions-es-es.json";
import questionsEsAr from "src/feedback/overallFeedback/feedbackForm/questions-es-ar.json";

// --- i18n initialization ---
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      [Locale.EN_GB]: {
        translation: { ...enGb, questions: questionsEnGb },
      },
      [Locale.EN_US]: {
        translation: { ...enUs, questions: questionsEnUs },
      },
      [Locale.ES_ES]: {
        translation: { ...esEs, questions: questionsEsEs },
      },
      [Locale.ES_AR]: {
        translation: { ...esAr, questions: questionsEsAr },
      },
    },
    fallbackLng: Locale.EN_GB,
    interpolation: { escapeValue: false },
  });

// ========================================================
//             Unexpected Events
// ========================================================
i18n.on("missingKey", (languages, namespace, key: string, res: string) => {
  console.error(`Missing translation for key`, {
    languages,
    namespace,
    key,
    res,
  });
});

i18n.on("failedLoading", (lng, ns, msg) => {
  console.error(`Failed to load translation for ${lng} ${ns}`, msg);
});

// --- Normalize legacy or lowercase locale codes automatically ---
const normalizedLang = i18n.language.toLowerCase();
switch (normalizedLang) {
  case "en":
  case "en-gb":
    i18n.changeLanguage(Locale.EN_GB);
    break;
  case "en-us":
    i18n.changeLanguage(Locale.EN_US);
    break;
  case "es":
  case "es-es":
    i18n.changeLanguage(Locale.ES_ES);
    break;
  case "es-ar":
    i18n.changeLanguage(Locale.ES_AR);
    break;
  default:
    i18n.changeLanguage(Locale.EN_GB);
}

export default i18n;
