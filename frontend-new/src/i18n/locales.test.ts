import fs from 'fs';
import path from 'path';

/* 
──────────────────────────────────────────────────────────────
🧪 TEST CONTEXT
──────────────────────────────────────────────────────────────

Feature: Consistency of i18n Translation Keys
  As a developer maintaining multilingual support
  I want all locale files to contain the same translation keys
  So that users experience consistent UI text across all languages

  Background:
    Given the reference language is "en"
    And the locales directory is located at "../locales"

  Scenario Outline: Verify translation key consistency across locales
    Given the reference translation file "locales/en/translation.json"
    When reading the translation file for "<language>"
    Then it should contain the same keys as the English reference file

    Examples:
      | language |
      | en-us    |
      | es       |
      | es-ar    |
      | fr-fr    |
──────────────────────────────────────────────────────────────
*/

const localesDir = path.join(__dirname, '../locales');
const referenceLanguage = 'en';

describe('Feature: i18n locales consistency', () => {
  const referenceTranslationsPath = path.join(localesDir, referenceLanguage, 'translation.json');
  const referenceTranslations = JSON.parse(fs.readFileSync(referenceTranslationsPath, 'utf8'));
  const referenceKeys = Object.keys(referenceTranslations);

  const languageDirs = fs.readdirSync(localesDir).filter(dir => 
    fs.statSync(path.join(localesDir, dir)).isDirectory() && dir !== referenceLanguage
  );

  languageDirs.forEach(lang => {
    it(`Scenario: ${lang} should have the same keys as ${referenceLanguage}`, () => {
      // GIVEN
      const translationPath = path.join(localesDir, lang, 'translation.json');

      // WHEN
      const translations = JSON.parse(fs.readFileSync(translationPath, 'utf8'));
      const translationKeys = Object.keys(translations);

      // THEN
      expect(translationKeys.sort()).toEqual(referenceKeys.sort());
    });
  });
});
