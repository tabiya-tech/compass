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
jest.mock("react-i18next", () => {
    const enTranslations = require("src/locales/en/translation.json");
    
    const stableT = (key: string) =>
    (enTranslations as Record<string, string>)[key] || key;

    return {
        useTranslation: () => ({
            t: stableT,
            i18n: {
                changeLanguage: jest.fn().mockResolvedValue(null),
            }
            }),
        initReactI18next: {
            type: "3rdParty",
            init: jest.fn(),
        },
    };
});
