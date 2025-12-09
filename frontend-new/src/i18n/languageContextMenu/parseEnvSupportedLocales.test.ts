// mute chatty console
import "src/_test_utilities/consoleMock";

import { FALL_BACK_LOCALE, Locale } from "src/i18n/constants";
import { parseEnvSupportedLocales } from "src/i18n/languageContextMenu/parseEnvSupportedLocales";
import * as EnvService from "src/envService";

describe("parseEnvSupportedLocales", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ["es-ES", `["es-ES"]`, [Locale.ES_ES], { warnings: 0, errors: 0 }],
    ["en-GB", `["es-ES", "en-GB"]`, [Locale.ES_ES, Locale.EN_GB], { warnings: 0, errors: 0 }],
    ["", `["es-ES", "es-AR"]`, [Locale.ES_ES, Locale.ES_AR], { warnings: 0, errors: 0 }],
    ["", `["es-ES", "es-AR", "invalid-locale"]`, [Locale.ES_ES, Locale.ES_AR], { warnings: 0, errors: 1 }],
    [
      "invalid-default-locale",
      `["es-ES", "es-AR", "invalid-locale"]`,
      [Locale.ES_ES, Locale.ES_AR],
      {
        warnings: 0,
        errors: 1,
      },
    ],
    ["es-AR", `invalid-array`, [Locale.ES_AR], { warnings: 0, errors: 1 }],
    ["es-ES", `[]`, [Locale.ES_ES], { warnings: 0, errors: 1 }],
    ["", `invalid-array`, [FALL_BACK_LOCALE], { warnings: 0, errors: 2 }],
    ["", `[]`, [FALL_BACK_LOCALE], { warnings: 0, errors: 2 }],
    ["invalid-default-locale", `invalid-array`, [FALL_BACK_LOCALE], { warnings: 0, errors: 2 }],
  ])(
    "should return the correct locale given env default %s and supported %s",
    (givenEnvDefaultLocale, givenEnvSupportedLocales, expectedSupportedLocales, logExpectations) => {
      // GIVEN an environment variables for default locale.
      jest.spyOn(EnvService, "getDefaultLocale").mockReturnValue(givenEnvDefaultLocale);

      // AND an environment variable for supported locales.
      jest.spyOn(EnvService, "getSupportedLocales").mockReturnValue(givenEnvSupportedLocales);

      // WHEN parsing the env supported locales.
      const actualSupportedLocales = parseEnvSupportedLocales();

      // THEN expect the supported locales to match the expected supported locales.
      expect(actualSupportedLocales).toIncludeAllMembers(expectedSupportedLocales);

      // AND warnings should be called accordingly
      expect(console.warn).toHaveBeenCalledTimes(logExpectations.warnings);

      // AND errors should be called accordingly
      expect(console.error).toHaveBeenCalledTimes(logExpectations.errors);
    }
  );
});
