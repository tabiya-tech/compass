import fs from "fs";
import path from "path";
import { Locale, SupportedLocales } from "src/i18n/constants";

const referenceLanguage = Locale.EN_GB;
const localesDir = __dirname;

// @ts-ignore
type TranslationObject = Record<string, string | TranslationObject>;

/**
 * Recursively replaces all values in a nested TranslationObject with a dash ("-").
 * Traverses through the object, and for any nested object, applies the same operation.
 *
 * This function is created to verify that each translation key in the reference file (en)
 * is also available in every language file.
 *
 * @param {TranslationObject} value - The input object containing nested values that will be replaced with a dash.
 * @return {TranslationObject} - A new object with all values replaced with a dash.
 */
function replaceValuesWithDash(value: TranslationObject): TranslationObject {
  if (typeof value === "object") {
    const out: TranslationObject = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        out[key] = replaceValuesWithDash(value[key]);
      }
    }
    return out;
  }

  // On the leaf node, replace the value with a dash
  return "-";
}

describe("Feature: i18n locales consistency", () => {
  const referenceTranslationsPath = path.join(localesDir, referenceLanguage, "translation.json");
  const referenceTranslations = JSON.parse(fs.readFileSync(referenceTranslationsPath, "utf8"));

  const languageDirs = fs
    .readdirSync(localesDir)
    .filter((dir) => fs.statSync(path.join(localesDir, dir)).isDirectory() && dir !== referenceLanguage);

  test.each(languageDirs)(`Scenario: %s should have the same keys as ${referenceLanguage}`, (lang) => {
    // GIVEN a translation path for a given language
    const translationPath = path.join(localesDir, lang, "translation.json");

    // WHEN comparing the translation path to the reference keys.
    const translations = JSON.parse(fs.readFileSync(translationPath, "utf8"));

    // THEN it should match with the reference keys.
    expect(replaceValuesWithDash(translations)).toEqual(replaceValuesWithDash(referenceTranslations));
  });

  test.each(SupportedLocales)("supported locale %s should have a translation file", (givenSupportedLocale) => {
    // GIVEN a supported locale
    // THEN it should have a translation file
    const expectedFile = path.join(localesDir, givenSupportedLocale, "translation.json");
    expect(fs.existsSync(expectedFile)).toBe(true);
  });
});
