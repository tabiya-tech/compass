import { FALL_BACK_LOCALE, Locale, SupportedLocales } from "src/i18n/constants";
import { getDefaultLocale, getSupportedLocales } from "src/envService";

/**
 * @private
 *
 * This error will be thrown if there is an issue with the locale env settings.
 */
export class ParseEnvLocaleError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ParseEnvLocaleError";
    this.cause = cause;
  }
}

/**
 * Parses the list of supported locales from the environment configuration.
 *
 * The method validates the retrieved locales against predefined constants and returns the supported, valid locales array.
 *
 * If validation fails or no supported locales are found, the method falls back to the default locale (from env)
 *      or a predefined fallback value.  {FALL_BACK_LOCALE}
 *
 * Note:-
 * This method is intended to never throw or return an empty array.
 *
 * @return {Locale[]} A list of supported and valid locales. If none is found, returns a fallback locale.
 */
export function parseEnvSupportedLocales(): Locale[] {
  try {
    const supportedLocalesStr = getSupportedLocales();
    const supportedLocales = JSON.parse(supportedLocalesStr) as Locale[];
    const supportedAndValidLocales = supportedLocales.filter((locale) => {
      // Filter out invalid and unsupported locales
      const isValid = Object.values(Locale).includes(locale);
      if (!isValid) {
        console.error(
          new ParseEnvLocaleError(
            `Invalid locale in FRONTEND_SUPPORTED_LOCALES: "${locale}". Must be one of: ${Object.values(Locale).join(", ")}`
          )
        );
        return false;
      }

      const isSupported = SupportedLocales.includes(locale);
      if (!isSupported) {
        console.error(
          new ParseEnvLocaleError(
            `Unsupported locale in FRONTEND_SUPPORTED_LOCALES: "${locale}". Supported locales: ${SupportedLocales.join(", ")}`
          )
        );
        return false;
      }

      return true;
    });

    if (supportedAndValidLocales.length > 0) {
      return supportedAndValidLocales;
    } else {
      console.error(
        new ParseEnvLocaleError(
          `FRONTEND_SUPPORTED_LOCALES contains no valid supported locales. Falling back to ${FALL_BACK_LOCALE}`
        )
      );
    }
  } catch (e) {
    console.error(
      new ParseEnvLocaleError(`Failed to parse supported locales JSON from env: value: ${getSupportedLocales()}`, e)
    );
  }

  const defaultLocaleStr = getDefaultLocale() as Locale;
  if (!defaultLocaleStr) {
    console.error(
      new ParseEnvLocaleError(
        `FRONTEND_DEFAULT_LOCALE is not set or empty. Falling back to ${FALL_BACK_LOCALE}`
      )
    );
    return [FALL_BACK_LOCALE];
  }

  if (!SupportedLocales.includes(defaultLocaleStr)) {
    console.error(
      new ParseEnvLocaleError(
        `FRONTEND_DEFAULT_LOCALE "${defaultLocaleStr}" is not supported. Supported locales: ${SupportedLocales.join(", ")}. Falling back to ${FALL_BACK_LOCALE}`
      )
    );
    return [FALL_BACK_LOCALE];
  }

  return [defaultLocaleStr];
}
