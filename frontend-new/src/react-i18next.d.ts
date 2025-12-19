import type { i18n as I18nInstance } from "i18next";
import defaultLanguage from "src/i18n/locales/en-GB/translation.json";

/**
 * Generate dot-notation keys from translation JSON
 */
type DotKeys<T> = {
  [K in keyof T & string]: T[K] extends Record<string, any>
    ? `${K}` | `${K}.${DotKeys<T[K]>}`
    : `${K}`;
}[keyof T & string];

export type TranslationKey = DotKeys<typeof defaultLanguage>;
export type TypedTFunction = TFunction<"translation"> & {
  (key: TranslationKey, options?: Record<string, any>): string;
};

/**
 * Module augmentation
 * -------------------
 * keep the original return shape of useTranslation(),
 * but narrow the type of t() so only valid keys are allowed.
 */
declare module "react-i18next" {
  export function useTranslation(): {
    t: (
      key: TranslationKey,
      options?: Record<string, any>
    ) => string;
    i18n: I18nInstance;
  };
}
