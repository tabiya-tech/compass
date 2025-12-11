import { type TOptions } from "i18next";
/**
 * Load English translations and create a stable translation function.
 *
 * enTranslations: Loads all English translation key-value pairs from a JSON file.
 * stableT: A simple translation function that returns the translation string if the key exists,
 *           otherwise it throws an error to fail tests early and prompt adding the missing key.
 *           This ensures tests have predictable translations.
 */
import enTranslations from "src/i18n/locales/en-GB/translation.json";
import questionsEnGb from "src/feedback/overallFeedback/feedbackForm/questions-en-GB.json";

const mockTranslations = {
  ...enTranslations,
  questions: questionsEnGb,
};

/**
 * A synchronous translation function for unit tests.
 * It looks up translation keys in the mock translation objects as i18next would.
 * - Supports dot-notation for nested keys (e.g. "foo.bar.baz").
 * - Replaces {{placeholders}} with provided options.
 * - Supports returning nested objects for { returnObjects: true }.
 * - Throws an error if the key is missing.
 * - Logs an error if the key is not found for early catching.
 *
 * @example
 * stableT("greeting", { name: "Doe" }) // => "Hello, Doe!"
 * stableT("menu.items", { returnObjects: true }) // => { home: "Home", about: "About" }
 * // stableT("missing.key") // Throws an error: "Translation key not found: missing.key"
 */
const stableT = (key: string, options?: TOptions) => {
  // Resolve nested key from the mockTranslations:
  //  eg: "home.title" → mockTranslations.home.title
  const resolved = key.split(".").reduce<any>((acc, part) => acc?.[part], mockTranslations);

  if (!resolved) {
    const errorMessage = `Translation key not found: ${key}`;
    // Fail early during the CI, so that the developer is prompted to add the missing translation key.
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  if (options?.returnObjects) {
    return resolved;
  }

  // Replace {{token}} placeholders with values
  let result = resolved;
  for (const [token, value] of Object.entries(options ?? {})) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result = result.replaceAll(`{{${token}}}`, String(value));
    }
  }
  return result;
};

jest.mock("react-i18next", () => {
  const React = require("react");
  const { Locale } = require("src/i18n/constants");

  /**
   * Test mock of the <Trans /> component from react-i18next.
   * - Renders translation strings with <0>...</0>, <1>...</1> markers by injecting corresponding React components.
   * - Handles basic replacement of markers: <0> gets components[0], <1> gets components[1], etc.
   * - Interpolates provided values in the translated text.
   *
   * @example
   * // Translation: "Click <0>here</0> for details."
   * <Trans i18nKey="foo.click" components={[<a />]} />
   * // Renders: Click <a>here</a> for details.
   */
  const Trans = ({ i18nKey, values, components }: any) => {
    const text = String(stableT(i18nKey, values));

    // Extract content inside a numbered placeholder tag like <0>...</0>, <1>...</1>, etc.
    const tagMatch = /<(\d+)>(.*?)<\/\1>/.exec(text);
    const componentIndex = tagMatch ? Number.parseInt(tagMatch[1], 10) : -1;
    const match = tagMatch?.[0];
    const content = tagMatch?.[2];

    // If no placeholder is found or the corresponding component is missing,
    // return the plain text, removing any leftover tags
    if (!match || componentIndex < 0 || !components?.[componentIndex]) {
      return React.createElement(React.Fragment, null, text.replaceAll(/<\/?(\d+)>/g, ""));
    }

    // Split text around the placeholder and wrap the inner content with the corresponding component
    const [before, after] = text.split(match);
    return React.createElement(
      React.Fragment,
      null,
      before,
      React.cloneElement(components[componentIndex], {}, content),
      after
    );
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
    t: stableT,
    use: jest.fn().mockReturnThis(),
    init: jest.fn().mockReturnThis(),
  };
  return {
    __esModule: true,
    default: mock,
    ...mock,
  };
});
