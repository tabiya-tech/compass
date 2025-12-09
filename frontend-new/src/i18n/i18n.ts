import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { DEFAULT_LOCALE, Locale } from "./constants";
import { constructLocaleResources } from "./utils";

// --- Import translations ---
import enGb from "./locales/en-GB/translation.json";
import enUs from "./locales/en-US/translation.json";
import esEs from "./locales/es-ES/translation.json";
import esAr from "./locales/es-AR/translation.json";

// --- Import feedback questions ---
import questionsEnGb from "src/feedback/overallFeedback/feedbackForm/questions-en-GB.json";
import questionsEnUs from "src/feedback/overallFeedback/feedbackForm/questions-en-US.json";
import questionsEsEs from "src/feedback/overallFeedback/feedbackForm/questions-es-ES.json";
import questionsEsAr from "src/feedback/overallFeedback/feedbackForm/questions-es-AR.json";

// --- i18n initialization ---
const resources = {
  // For each locale, construct the locale resources for each possible case
  //   - for only language without a region e.g.: `en`
  //   - or for cases where the language does not follow [IETF BCP 47](https://www.ietf.org/rfc/bcp/bcp47.txt) format eg: en-ng

  // Note: since both en-GB and en-US share the same language code `en`,
  //       if the user has stated the en, then en-US will be used since it is at a later position.
  //       same with the es-AR and es-ES, es, if the user has provided es, es-ES will be used.
  //       We are relying on the JS object construction here.
  //       The last object entry will override the previous entry.
  ...constructLocaleResources(Locale.EN_GB, { ...enGb, questions: questionsEnGb }),
  ...constructLocaleResources(Locale.EN_US, { ...enUs, questions: questionsEnUs }),
  ...constructLocaleResources(Locale.ES_AR, { ...esAr, questions: questionsEsAr }),
  ...constructLocaleResources(Locale.ES_ES, { ...esEs, questions: questionsEsEs }),
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
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

export default i18n;
