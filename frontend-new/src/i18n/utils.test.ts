// mute the console
import "src/_test_utilities/consoleMock";

import { Locale } from "./constants";
import * as Utils from "./utils";

describe("utils", () => {
  describe("constructLocaleResources", () => {
    test("it should return a dictionary with all possible locale names.", () => {
      // GIVEN that getPossibleLocaleNames will return a successful array
      const givenPossibleLocale = "foo";

      // AND given a locale
      const givenLocale = givenPossibleLocale as Locale;

      // AND given a resource language.
      const givenResourceLanguage = {
        "some-text": "some-value",
      };

      // WHEN the constructLocaleResources is constructed
      const actualResource = Utils.constructLocaleResources(givenLocale, givenResourceLanguage);

      // THEN the actual resource should be a dictionary with all the possible locale names as keys and the resource language as value.
      expect(actualResource).toStrictEqual({
        [givenPossibleLocale]: {
          translation: givenResourceLanguage,
        },
      });
    });
  });

  describe("getPossibleLocaleNames", () => {
    test.each([
      [Locale.EN_GB, ["en-GB", "en-gb", "en"]],
      [Locale.EN_US, ["en-US", "en-us", "en"]],
      [Locale.ES_AR, ["es-AR", "es-ar", "es"]],
      [Locale.ES_ES, ["es-ES", "es-es", "es"]],
      ["en" as Locale, ["en"]],
      ["foo-ba" as Locale, ["foo", "foo-BA", "foo-ba"]],
    ])("should return the correct locale names for %s", (givenLocale, expectedPossibleLocaleName) => {
      // GIVEN a locale name.
      // WHEN computing all the possible locale names a user can provide
      const actualPossibleLocaleNames = Utils.getPossibleLocaleNames(givenLocale);
      // THEN they should match the expected
      expect(actualPossibleLocaleNames).toIncludeSameMembers(expectedPossibleLocaleName);
    });

    test("should return the default locale if Intl.Locale.constructor throws an error", () => {
      // GIVEN Intl.Locale will throw an error because of
      //       - not supported
      //       - invalid locale
      const error = new Error("Invalid locale");
      jest.spyOn(window.Intl, "Locale").mockImplementation(() => {
        throw error;
      });

      // AND a givenLocale
      const givenLocale = Locale.EN_US;

      // WHEN computing all the possible locale names a user can provide
      const actualPossibleLocaleNames = Utils.getPossibleLocaleNames(givenLocale);

      // THEN an error should be logged.
      expect(console.error).toHaveBeenCalled();

      // AND the response should be the passed locale.
      expect(actualPossibleLocaleNames).toStrictEqual([givenLocale]);
    });
  });
});
