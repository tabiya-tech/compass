import { getDefaultLocale } from "src/envService";

// Default locale, now loaded from environment variable FRONTEND_DEFAULT_LOCALE (base64-encoded in env.js)
export const DEFAULT_LOCALE = getDefaultLocale();

export enum Locale {
  EN_GB = "en-GB",
  EN_US = "en-US",
  ES_ES = "es-ES",
  ES_AR = "es-AR",
  SW_KE = "sw-KE",
  NY_ZM = "ny-ZM",
  PT_MZ = "pt-MZ",
}

export const LocalesLabels = {
  [Locale.EN_GB]: "English (UK)",
  [Locale.EN_US]: "English (US)",
  [Locale.ES_ES]: "Español (España)",
  [Locale.ES_AR]: "Español (Argentina)",
  [Locale.SW_KE]: "Kiswahili (Kenya)",
  [Locale.NY_ZM]: "Nyanja (Zambia)",
  [Locale.PT_MZ]: "Portuguese (Mozambique)",
} as const;

export const SupportedLocales: Locale[] = [
  Locale.EN_GB,
  Locale.EN_US,
  Locale.ES_ES,
  Locale.ES_AR,
  Locale.SW_KE,
  Locale.NY_ZM,
  Locale.PT_MZ,
];
export const FALL_BACK_LOCALE = Locale.EN_GB;
