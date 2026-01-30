import { EnvError } from "./error/commonErrors";

export enum EnvVariables {
  FIREBASE_AUTH_DOMAIN = "FIREBASE_AUTH_DOMAIN",
  FIREBASE_API_KEY = "FIREBASE_API_KEY",
  BACKEND_URL = "BACKEND_URL",
  FRONTEND_SENTRY_DSN = "FRONTEND_SENTRY_DSN",
  FRONTEND_ENABLE_SENTRY = "FRONTEND_ENABLE_SENTRY",
  FRONTEND_SENTRY_CONFIG = "FRONTEND_SENTRY_CONFIG",
  TARGET_ENVIRONMENT_NAME = "TARGET_ENVIRONMENT_NAME",
  SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY = "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY",
  SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID = "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID",
  FRONTEND_LOGIN_CODE = "FRONTEND_LOGIN_CODE",
  GLOBAL_DISABLE_LOGIN_CODE = "GLOBAL_DISABLE_LOGIN_CODE",
  FRONTEND_REGISTRATION_CODE = "FRONTEND_REGISTRATION_CODE",
  FRONTEND_DISABLE_REGISTRATION = "FRONTEND_DISABLE_REGISTRATION",
  GLOBAL_DISABLE_REGISTRATION_CODE = "GLOBAL_DISABLE_REGISTRATION_CODE",
  FRONTEND_ENABLE_METRICS = "FRONTEND_ENABLE_METRICS",
  FRONTEND_METRICS_CONFIG = "FRONTEND_METRICS_CONFIG",
  FRONTEND_ENABLE_CV_UPLOAD = "FRONTEND_ENABLE_CV_UPLOAD",
  FRONTEND_FEATURES = "FRONTEND_FEATURES",
  FRONTEND_DISABLE_SOCIAL_AUTH = "FRONTEND_DISABLE_SOCIAL_AUTH",
  FRONTEND_SUPPORTED_LOCALES = "FRONTEND_SUPPORTED_LOCALES",
  FRONTEND_DEFAULT_LOCALE = "FRONTEND_DEFAULT_LOCALE",
  GLOBAL_PRODUCT_NAME = "GLOBAL_PRODUCT_NAME",
  FRONTEND_BROWSER_TAB_TITLE = "FRONTEND_BROWSER_TAB_TITLE",
  FRONTEND_META_DESCRIPTION = "FRONTEND_META_DESCRIPTION",
  FRONTEND_SEO = "FRONTEND_SEO",
  FRONTEND_LOGO_URL = "FRONTEND_LOGO_URL",
  FRONTEND_FAVICON_URL = "FRONTEND_FAVICON_URL",
  FRONTEND_APP_ICON_URL = "FRONTEND_APP_ICON_URL",
  FRONTEND_THEME_CSS_VARIABLES = "FRONTEND_THEME_CSS_VARIABLES",
}

export const requiredEnvVariables = [
  EnvVariables.FIREBASE_AUTH_DOMAIN,
  EnvVariables.FIREBASE_API_KEY,
  EnvVariables.BACKEND_URL,
  EnvVariables.TARGET_ENVIRONMENT_NAME,
  EnvVariables.SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY,
  EnvVariables.SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID,
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
 * Notes:
 * - This function is designed to reverse only the Base64 encoding applied for obfuscation.
 * - It does not attempt to infer or parse the meaning or type of the decoded data.
 *   The calling code is responsible for handling the data appropriately (e.g. parsing JSON,
 *   decoding binary data, converting to numbers, etc.).
 * - Binary content (such as images or files) should be base64-encoded before being written
 *   to the `.env` file. The consumer must then manually convert the decoded string back
 *   into a binary format (e.g. a Blob or Uint8Array).
 *
 * Examples:
 *
 * 1. Unicode Text (e.g., Chinese "好运" = "Good Luck")
 *
 * // Python encoding step (in prepare_frontend.py):
 * base64.b64encode("好运".encode("utf-8"))  # Yields: b'5aSn5a2m'
 *
 * // Decoding in frontend (handled internally by getEnv):
 * const value = getEnv("APP_TITLE");
 * console.log(value); // "好运"
 *
 * 2. Binary Data (e.g., JPEG Image)
 *
 * // Assume a JPEG file was base64-encoded and added to `.env`:
 * MY_IMAGE="base64-encoded-string-of-jpeg"
 *
 * // Retrieve and convert to binary:
 * const base64String = getEnv("MY_IMAGE");
 * const binary = Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
 * const blob = new Blob([binary], { type: "image/jpeg" });
 * const imageUrl = URL.createObjectURL(blob);
 *
 * // Use in an <img> tag:
 * document.getElementById("preview").src = imageUrl;
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
  return getEnv(EnvVariables.FIREBASE_AUTH_DOMAIN);
};

export const getFirebaseAPIKey = () => {
  return getEnv(EnvVariables.FIREBASE_API_KEY);
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

export const getSensitivePersonalDataRSAEncryptionKey = () => {
  return getEnv(EnvVariables.SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY);
};

export const getSensitivePersonalDataRSAEncryptionKeyId = () => {
  return getEnv(EnvVariables.SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID);
};

export const getApplicationLoginCode = () => {
  return getEnv(EnvVariables.FRONTEND_LOGIN_CODE);
};

export const getApplicationRegistrationCode = () => {
  return getEnv(EnvVariables.FRONTEND_REGISTRATION_CODE);
};

export const getLoginCodeDisabled = () => {
  return getEnv(EnvVariables.GLOBAL_DISABLE_LOGIN_CODE);
};

export const getRegistrationDisabled = () => {
  return getEnv(EnvVariables.FRONTEND_DISABLE_REGISTRATION);
};

export const getRegistrationCodeDisabled = () => {
  return getEnv(EnvVariables.GLOBAL_DISABLE_REGISTRATION_CODE);
};

export const getMetricsEnabled = () => {
  return getEnv(EnvVariables.FRONTEND_ENABLE_METRICS);
};

export const getMetricsConfig = () => {
  return getEnv(EnvVariables.FRONTEND_METRICS_CONFIG);
};

export const getFeatures = () => {
  return getEnv(EnvVariables.FRONTEND_FEATURES);
};

export const getCvUploadEnabled = () => {
  return getEnv(EnvVariables.FRONTEND_ENABLE_CV_UPLOAD);
};

export const getSocialAuthDisabled = () => {
  return getEnv(EnvVariables.FRONTEND_DISABLE_SOCIAL_AUTH);
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
    return "Compass";
  }

  return envAppName;
};

export const getBrowserTabTitle = () => getEnv(EnvVariables.FRONTEND_BROWSER_TAB_TITLE);

export const getMetaDescription = () => getEnv(EnvVariables.FRONTEND_META_DESCRIPTION);

export const getSeoEnvVar = () => getEnv(EnvVariables.FRONTEND_SEO);

export const getLogoUrl = () => getEnv(EnvVariables.FRONTEND_LOGO_URL);

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
