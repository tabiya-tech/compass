import { type Resource, type ResourceLanguage } from "i18next";
import { Locale } from "./constants";

class ParseLocaleError extends Error {
  constructor(locale: string, cause: unknown) {
    super(`Invalid locale: ${locale}`);
    this.name = "ParseLocaleError";
    this.cause = cause;
  }
}

/**
 * Get all possible locale names for a given locale name.
 *
 * e.g.:
 * en-NG/en-ng -> en, en-ng, en-NG
 * en -> en
 */
export function getPossibleLocaleNames(locale: Locale): string[] {
  try {
    const intlLocale = new Intl.Locale(locale);
    const possibleLocaleNames = [locale, intlLocale.language, locale.toLowerCase()];

    if (intlLocale.region) {
      possibleLocaleNames.push(`${intlLocale.language}-${intlLocale.region.toUpperCase()}`);
    }

    // Remove duplicates.
    return Array.from(new Set(possibleLocaleNames));
  } catch (e) {
    // Intl.Locale has been supported in all major browsers since 2019-2020.
    // This catch block is mainly for environments where Intl.Locale is unavailable (e.g., very old browsers or non-browser environments).
    console.error(new ParseLocaleError(locale, e));
    return [locale];
  }
}

export function constructLocaleResources(locale: Locale, resourceLanguage: ResourceLanguage): Resource {
  return getPossibleLocaleNames(locale).reduce<Resource>((acc, localeName) => {
    acc[localeName] = { translation: resourceLanguage };
    return acc;
  }, {});
}
