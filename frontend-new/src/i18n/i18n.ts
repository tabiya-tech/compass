import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// --- Import translations ---
import enGb from "../locales/en-gb/translation.json"; 
import enUs from "../locales/en-us/translation.json";
import esEs from "../locales/es-es/translation.json";
import esAr from "../locales/es-ar/translation.json";
import frFr from "../locales/fr-fr/translation.json";

// --- Import feedback questions ---
import questionsEnGb from "src/feedback/overallFeedback/feedbackForm/questions-en-gb.json";
import questionsEnUs from "src/feedback/overallFeedback/feedbackForm/questions-en-us.json";
import questionsEsEs from "src/feedback/overallFeedback/feedbackForm/questions-es-es.json";
import questionsEsAr from "src/feedback/overallFeedback/feedbackForm/questions-es-ar.json";
import questionsFrFr from "src/feedback/overallFeedback/feedbackForm/questions-fr-fr.json";

// --- Enum for languages ---
export enum Languages {
  EN_GB = "en-GB",
  EN_US = "en-US",
  ES_ES = "es-ES",
  ES_AR = "es-AR",
  FR_FR = "fr-FR",
}

// --- Feedback translations ---
const feedbackTranslations = {
  [Languages.EN_GB]: {
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
   [Languages.EN_US]: {
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
  [Languages.ES_AR]: {
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
  [Languages.ES_ES]: {
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
  [Languages.FR_FR]: {
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

// --- i18n initialization ---
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      [Languages.EN_GB]: {
        translation: { ...enGb, questions: questionsEnGb, ...feedbackTranslations[Languages.EN_GB] },
      },
      [Languages.EN_US]: {
        translation: { ...enUs, questions: questionsEnUs, ...feedbackTranslations[Languages.EN_US] }, 
      },
      [Languages.ES_ES]: {
        translation: { ...esEs, questions: questionsEsEs, ...feedbackTranslations[Languages.ES_ES] },
      },
      [Languages.ES_AR]: {
        translation: { ...esAr, questions: questionsEsAr, ...feedbackTranslations[Languages.ES_AR] },
      },
      [Languages.FR_FR]: {
        translation: { ...frFr, questions: questionsFrFr, ...feedbackTranslations[Languages.FR_FR] },
      },
    },
    fallbackLng: Languages.EN_GB,
    interpolation: { escapeValue: false },
  });

// --- Normalize legacy or lowercase locale codes automatically ---
const normalizedLang = i18n.language.toLowerCase();
switch (normalizedLang) {
  case "en":
  case "en-gb":
    i18n.changeLanguage(Languages.EN_GB);  
    break;
  case "en-us":
    i18n.changeLanguage(Languages.EN_US);  
    break;    
  case "es":
  case "es-es":
    i18n.changeLanguage(Languages.ES_ES);
    break;
  case "es-ar":
    i18n.changeLanguage(Languages.ES_AR);
    break;
  case "fr":
  case "fr-fr":
    i18n.changeLanguage(Languages.FR_FR);
    break;
  default:
    i18n.changeLanguage(Languages.EN_GB);
}

export default i18n;
