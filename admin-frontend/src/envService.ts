import { EnvError } from "./error/commonErrors";

export enum EnvVariables {
  ADMIN_FRONTEND_FIREBASE_AUTH_DOMAIN = "ADMIN_FRONTEND_FIREBASE_AUTH_DOMAIN",
  ADMIN_FRONTEND_FIREBASE_API_KEY = "ADMIN_FRONTEND_FIREBASE_API_KEY",
  ADMIN_FRONTEND_FIREBASE_TENANT_ID = "ADMIN_FRONTEND_FIREBASE_TENANT_ID",
  ADMIN_FRONTEND_FIREBASE_PROJECT_ID = "ADMIN_FRONTEND_FIREBASE_PROJECT_ID",
  BACKEND_URL = "BACKEND_URL",
  FRONTEND_SENTRY_DSN = "FRONTEND_SENTRY_DSN",
  FRONTEND_ENABLE_SENTRY = "FRONTEND_ENABLE_SENTRY",
  FRONTEND_SENTRY_CONFIG = "FRONTEND_SENTRY_CONFIG",
  TARGET_ENVIRONMENT_NAME = "TARGET_ENVIRONMENT_NAME",
  SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY = "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY",
  SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID = "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID",
  FRONTEND_SUPPORTED_LOCALES = "FRONTEND_SUPPORTED_LOCALES",
  FRONTEND_DEFAULT_LOCALE = "FRONTEND_DEFAULT_LOCALE",
  GLOBAL_PRODUCT_NAME = "GLOBAL_PRODUCT_NAME",
  FRONTEND_BROWSER_TAB_TITLE = "FRONTEND_BROWSER_TAB_TITLE",
  FRONTEND_META_DESCRIPTION = "FRONTEND_META_DESCRIPTION",
  FRONTEND_SEO = "FRONTEND_SEO",
  FRONTEND_LOGO_URL = "FRONTEND_LOGO_URL",
  FRONTEND_MINISTRY_URL = "FRONTEND_MINISTRY_URL",
  FRONTEND_DARK_LOGO_URL = "FRONTEND_DARK_LOGO_URL",
  FRONTEND_FAVICON_URL = "FRONTEND_FAVICON_URL",
  FRONTEND_APP_ICON_URL = "FRONTEND_APP_ICON_URL",
  FRONTEND_THEME_CSS_VARIABLES = "FRONTEND_THEME_CSS_VARIABLES",
  LEGAL_SITE_BASE_URL = "LEGAL_SITE_BASE_URL",
}

export const requiredEnvVariables = [
  EnvVariables.ADMIN_FRONTEND_FIREBASE_AUTH_DOMAIN,
  EnvVariables.ADMIN_FRONTEND_FIREBASE_API_KEY,
  EnvVariables.BACKEND_URL,
  EnvVariables.TARGET_ENVIRONMENT_NAME,
  EnvVariables.FRONTEND_SUPPORTED_LOCALES,
  EnvVariables.FRONTEND_DEFAULT_LOCALE,
];

/**
 * Retrieves an environment variable from the global `tabiyaConfig` object.
 *
 * This method provides synchronous access to environment variables defined in `env.js`,
 * which is included via `index.html`. All values in `tabiyaConfig` are expected to be
 * Base64-encoded UTF-8 strings, as produced during the build process (e.g., by
 * `iac/frontend/prepare_frontend.py`).
 *
 * Upon retrieval, this function automatically decodes the Base64 string and interprets it
 * as UTF-8 using `TextDecoder`, ensuring correct handling of Unicode characters.
 *
 * If the variable is missing or an error occurs during decoding, an empty string is returned,
 * and an `EnvError` is logged to the console.
 *
 * @param key - The name of the environment variable to retrieve.
 * @returns The decoded UTF-8 string, or an empty string if not found or invalid.
 */
export const getEnv = (key: string): string => {
  try {
    const env = (window as any).tabiyaConfig;
    const base64Value = env?.[key];
    if (!base64Value) {
      return "";
    }

    const binary = window.atob(base64Value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    console.error(new EnvError(`Error loading environment variable ${key}`, e));
    return "";
  }
};

export const getFirebaseDomain = () => {
  return getEnv(EnvVariables.ADMIN_FRONTEND_FIREBASE_AUTH_DOMAIN);
};

export const getFirebaseAPIKey = () => {
  return getEnv(EnvVariables.ADMIN_FRONTEND_FIREBASE_API_KEY);
};

export const getFirebaseTenantId = () => {
  return getEnv(EnvVariables.ADMIN_FRONTEND_FIREBASE_TENANT_ID);
};

export const getFirebaseProjectId = () => {
  return getEnv(EnvVariables.ADMIN_FRONTEND_FIREBASE_PROJECT_ID);
};

export const getBackendUrl = () => {
  return getEnv(EnvVariables.BACKEND_URL);
};

export const getSentryDSN = () => {
  return getEnv(EnvVariables.FRONTEND_SENTRY_DSN);
};

export const getSentryConfig = () => {
  return getEnv(EnvVariables.FRONTEND_SENTRY_CONFIG);
};

export const getSentryEnabled = () => {
  return getEnv(EnvVariables.FRONTEND_ENABLE_SENTRY);
};

export const getTargetEnvironmentName = () => {
  return getEnv(EnvVariables.TARGET_ENVIRONMENT_NAME);
};

export const getSupportedLocales = () => {
  return getEnv(EnvVariables.FRONTEND_SUPPORTED_LOCALES);
};

export const getDefaultLocale = () => {
  return getEnv(EnvVariables.FRONTEND_DEFAULT_LOCALE);
};

export const getProductName = () => {
  const envAppName = getEnv(EnvVariables.GLOBAL_PRODUCT_NAME);
  if (!envAppName) {
    console.warn("Product name not set, keeping the default");
    return "Admin";
  }

  return envAppName;
};

export const getBrowserTabTitle = () => getEnv(EnvVariables.FRONTEND_BROWSER_TAB_TITLE);

export const getMetaDescription = () => getEnv(EnvVariables.FRONTEND_META_DESCRIPTION);

export const getSeoEnvVar = () => getEnv(EnvVariables.FRONTEND_SEO);

export const getLogoUrl = () => getEnv(EnvVariables.FRONTEND_LOGO_URL);

export const DEFAULT_MINISTRY_URL = "/ministry-tech.png";

export const getMinistryUrl = () => getEnv(EnvVariables.FRONTEND_MINISTRY_URL) || DEFAULT_MINISTRY_URL;

export const getDarkLogoUrl = () => getEnv(EnvVariables.FRONTEND_DARK_LOGO_URL);

export const getFaviconUrl = () => getEnv(EnvVariables.FRONTEND_FAVICON_URL);

export const getAppIconUrl = () => getEnv(EnvVariables.FRONTEND_APP_ICON_URL);

export interface ThemeCssVariables {
  "brand-primary"?: string;
  "brand-primary-light"?: string;
  "brand-primary-dark"?: string;
  "brand-primary-contrast-text"?: string;
  "brand-secondary"?: string;
  "brand-secondary-light"?: string;
  "brand-secondary-dark"?: string;
  "brand-secondary-contrast-text"?: string;
  "page-background"?: string;
  "page-background-light"?: string;
  "page-background-dark"?: string;
  "page-background-contrast-text"?: string;
  "text-primary"?: string;
  "text-secondary"?: string;
  "text-accent"?: string;
}

export const getThemeCssVariables = (): ThemeCssVariables => {
  const jsonString = getEnv(EnvVariables.FRONTEND_THEME_CSS_VARIABLES);
  if (!jsonString) {
    return {};
  }

  try {
    return JSON.parse(jsonString) as ThemeCssVariables;
  } catch (e) {
    console.error(new EnvError(`Error parsing FRONTEND_THEME_CSS_VARIABLES JSON`, e));
    return {};
  }
};

export const ensureRequiredEnvVars = () => {
  requiredEnvVariables.forEach((key: EnvVariables) => {
    if (!getEnv(key)) {
      console.warn(`Required environment variable ${key} is not set`);
    }
  });
};
