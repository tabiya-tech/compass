// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import "@testing-library/jest-dom/extend-expect";
// jest extended adds more matchers
// allows you to do things like:
// expect().toHaveBeenCalledBefore();
// learn more: https://jest-extended.jestcommunity.dev/docs/
import "jest-extended/all";
// pollyfill because jsdom does not support TextEncoder
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextDecoder, TextEncoder });
// mock firebase for tests
jest.mock("firebase/compat/app", () => require("src/_test_utilities/firebaseMock"));

/**
 * Load English translations and create a stable translation function.
 *
 * enTranslations: Loads all English translation key-value pairs from a JSON file.
 * stableT: A simple translation function that returns the translation string if the key exists,
 *          otherwise it returns the key itself. This ensures tests have predictable translations.
 */
const enTranslations = require("src/i18n/locales/en-GB/translation.json");
const questionsEnGb = require("src/feedback/overallFeedback/feedbackForm/questions-en-US.json");

const feedbackTranslations = {
  questions: questionsEnGb,
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
  submit: "Submit",
  next: "Next",
  previous: "Previous",
  yes: "Yes",
  no: "No",
};

const errorTranslations = {
  errors: {
    experienceTitleMaxLength: "Maximum {{max}} characters allowed.",
    companyMaxLength: "Maximum {{max}} characters allowed.",
    locationMaxLength: "Maximum {{max}} characters allowed.",
    summaryMaxLength: "Maximum {{max}} characters allowed.",
    timelineMaxLength: "Maximum {{max}} characters allowed.",
  },
};

const mockTranslations = { ...enTranslations, ...feedbackTranslations, ...errorTranslations };

const stableT = (key: string, options?: any) => {
  const keys = key.split(".");
  let value: any = mockTranslations;
  for (const k of keys) {
    if (value === undefined || value === null) {
      value = undefined;
      break;
    }
    value = value[k];
  }

  if (options?.returnObjects) {
    if (value !== undefined && typeof value === "object") {
      return value;
    }
  }

  let text = value !== undefined ? value : key;

  if (typeof text === "string" && options) {
    Object.entries(options).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        text = text.replace(new RegExp(`{{${k}}}`, "g"), String(v));
      }
    });
  }

  return text;
};

/**
 * Mock the i18next module.
 *
 * This replaces i18next's `t` function with our stableT function in the test environment.
 * It allows any code importing `i18next` to call `t(key)` without actually initializing the library.
 */
jest.mock("i18next", () => ({
  t: stableT,
}));

jest.mock("react-i18next", () => {
  const React = require("react");
  const { Locale } = require("src/i18n/constants");

  const Trans = ({ i18nKey, values, components }: any) => {
    let text = stableT(i18nKey, values);
    // Replace component markers <0>...</0> with children placeholder
    const match = text.match(/<0>(.*?)<\/0>/);
    if (match && components && components[0]) {
      const inner = match[1];
      const Comp0 = components[0];
      const replaced = text.replace(/<0>(.*?)<\/0>/, "__TRANS_COMPONENT__");
      const parts = replaced.split("__TRANS_COMPONENT__");
      return React.createElement(React.Fragment, null, parts[0], React.cloneElement(Comp0, {}, inner), parts[1]);
    }
    // No components provided; just return plain text
    return React.createElement(React.Fragment, null, text.replace(/<\/?0>/g, ""));
  };

  return {
    useTranslation: () => ({
      t: stableT,
      i18n: {
        changeLanguage: jest.fn().mockResolvedValue(null),
        on: jest.fn(),
        off: jest.fn(),
        language: Locale.EN_US,
      },
    }),
    Trans,
    initReactI18next: {
      type: "3rdParty",
      init: jest.fn(),
    },
  };
});

// Mock the initialized instance module so app code can import it without side effects
jest.mock("src/i18n/i18n", () => {
  const mock = {
    t: (key: string, options?: Record<string, unknown>) => stableT(key, options),
    use: jest.fn().mockReturnThis(),
    init: jest.fn().mockReturnThis(),
  };
  return {
    __esModule: true,
    default: mock,
    ...mock,
  };
});
