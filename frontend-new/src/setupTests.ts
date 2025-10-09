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



/* 
──────────────────────────────────────────────────────────────
🧪 TEST CONTEXT
──────────────────────────────────────────────────────────────

Feature: Global Test Environment Setup
  As a developer running Jest tests
  I want a consistent global test configuration
  So that each test has predictable environment and localization behavior

  Background:
    Given jest-dom and jest-extended are loaded
    And TextEncoder/TextDecoder are polyfilled for jsdom
    And Firebase is mocked with local test utilities

  Scenario: Mock i18n translations globally
    Given the test environment is initialized
    When each test starts
    Then the "react-i18next" library should return translations from "src/locales/en/translation.json"
    And the i18n.changeLanguage function should be mocked as resolved
──────────────────────────────────────────────────────────────
*/

/**
 * Load English translations and create a stable translation function.
 * 
 * enTranslations: Loads all English translation key-value pairs from a JSON file.
 * stableT: A simple translation function that returns the translation string if the key exists,
 *          otherwise it returns the key itself. This ensures tests have predictable translations.
 */
const enTranslations = require("src/locales/en/translation.json");

const stableT = (key: string, options?: Record<string, unknown>) => {
    let text = (enTranslations as Record<string, string>)[key] || key;
    if (options) {
        Object.entries(options).forEach(([k, v]) => {
            text = text.replace(new RegExp(`{{${k}}}`, "g"), String(v));
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
   
    const Trans = ({ i18nKey, values, components }: any) => {
        let text = stableT(i18nKey, values);
        // Replace component markers <0>...</0> with children placeholder
        const match = text.match(/<0>(.*?)<\/0>/);
        if (match && components && components[0]) {
            const inner = match[1];
            const Comp0 = components[0];
            const replaced = text.replace(/<0>(.*?)<\/0>/, "__TRANS_COMPONENT__");
            const parts = replaced.split("__TRANS_COMPONENT__");
            return React.createElement(
                React.Fragment,
                null,
                parts[0],
                React.cloneElement(Comp0, {}, inner),
                parts[1]
            );
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
                 language: 'en', // Mock the current language
            },
        }),
        Trans,
        initReactI18next: {
            type: "3rdParty",
            init: jest.fn(),
        },
    };
});
