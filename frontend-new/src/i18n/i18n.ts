import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "../locales/en-us/translation.json";
import es from "../locales/es-es/translation.json";
import ar from "../locales/es-ar/translation.json";
import fr from "../locales/fr-fr/translation.json";

// Import feedback questions for each language
import questionsEnGb from "src/feedback/overallFeedback/feedbackForm/questions-en-gb.json";
import questionsEsAr from "src/feedback/overallFeedback/feedbackForm/questions-es-ar.json";
import questionsEsEs from "src/feedback/overallFeedback/feedbackForm/questions-es-es.json";
import questionsFrFr from "src/feedback/overallFeedback/feedbackForm/questions-fr-fr.json";

// Additional feedback form translations
const feedbackTranslations = {
  "en-US": {
    yes: "Yes",
    no: "No",
    steps: {
      biasAndExperience: "Bias & Experience Accuracy",
      skillAccuracy: "Skill Accuracy",
      finalFeedback: "Final feedback",
    },
    labels: {
      inaccurate: "Inaccurate",
      veryAccurate: "Very accurate",
      difficult: "Difficult",
      easy: "Easy",
      unlikely: "Unlikely",
      likely: "Likely",
    },
    buttons: {
      submit: "Submit",
      next: "Next",
      previous: "Previous",
    },
  },
  "es-AR": {
    yes: "Sí",
    no: "No",
    steps: {
      biasAndExperience: "Sesgo y Precisión de la Experiencia",
      skillAccuracy: "Precisión de Habilidades",
      finalFeedback: "Comentarios finales",
    },
    labels: {
      inaccurate: "Inexacto",
      veryAccurate: "Muy preciso",
      difficult: "Difícil",
      easy: "Fácil",
      unlikely: "Improbable",
      likely: "Probable",
    },
    buttons: {
      submit: "Enviar",
      next: "Siguiente",
      previous: "Anterior",
    },
  },
  "es-ES": {
    yes: "Sí",
    no: "No",
    steps: {
      biasAndExperience: "Sesgo y Precisión de la Experiencia",
      skillAccuracy: "Precisión de Habilidades",
      finalFeedback: "Comentarios finales",
    },
    labels: {
      inaccurate: "Inexacto",
      veryAccurate: "Muy preciso",
      difficult: "Difícil",
      easy: "Fácil",
      unlikely: "Improbable",
      likely: "Probable",
    },
    buttons: {
      submit: "Enviar",
      next: "Siguiente",
      previous: "Anterior",
    },
  },
  "fr-FR": {
    yes: "Oui",
    no: "Non",
    steps: {
      biasAndExperience: "Biais et Précision de l'Expérience",
      skillAccuracy: "Précision des Compétences",
      finalFeedback: "Commentaires finaux",
    },
    labels: {
      inaccurate: "Inexact",
      veryAccurate: "Très précis",
      difficult: "Difficile",
      easy: "Facile",
      unlikely: "Improbable",
      likely: "Probable",
    },
    buttons: {
      submit: "Soumettre",
      next: "Suivant",
      previous: "Précédent",
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "en-US": {
        translation: {
          ...en,
          questions: questionsEnGb,
          ...feedbackTranslations["en-US"],
        },
      },
      "en-GB": {
        translation: {
          ...en,
          questions: questionsEnGb,
          ...feedbackTranslations["en-US"],
        },
      },
      // Support lowercase variant to be lenient with detectors/storage
      "en-gb": {
        translation: {
          ...en,
          questions: questionsEnGb,
          ...feedbackTranslations["en-US"],
        },
      },
      "es-AR": {
        translation: {
          ...ar,
          questions: questionsEsAr,
          ...feedbackTranslations["es-AR"],
        },
      },
      "es-ES": {
        translation: {
          ...es,
          questions: questionsEsEs,
          ...feedbackTranslations["es-ES"],
        },
      },
      // Support lowercase variant
      "es-es": {
        translation: {
          ...es,
          questions: questionsEsEs,
          ...feedbackTranslations["es-ES"],
        },
      },
      "fr-FR": {
        translation: {
          ...fr,
          questions: questionsFrFr,
          ...feedbackTranslations["fr-FR"],
        },
      },
    },
    fallbackLng: "en-GB",
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;

// Normalize legacy saved language codes (e.g., in localStorage) to new standardized ones
try {
  const current = i18n.language;
  if (current === 'en') {
    i18n.changeLanguage('en-gb');
  } else if (current === 'es') {
    i18n.changeLanguage('es-es');
  }
} catch {
  // no-op
}