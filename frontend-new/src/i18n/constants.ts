import { getDefaultLocale } from "../envService";

// Default locale, now loaded from environment variable FRONTEND_DEFAULT_LOCALE (base64-encoded in env.js)
export const DEFAULT_LOCALE = getDefaultLocale();
