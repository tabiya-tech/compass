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
}

export const requiredEnvVariables = [
  EnvVariables.FIREBASE_AUTH_DOMAIN,
  EnvVariables.FIREBASE_API_KEY,
  EnvVariables.BACKEND_URL,
  EnvVariables.TARGET_ENVIRONMENT_NAME,
  EnvVariables.SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY,
  EnvVariables.SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID,
];

/**
 * Retrieves an environment variable from the global `tabiyaConfig` object.
 *
 * This method provides synchronous access to environment variables defined in `env.js`,
 * which is included via the `index.html`. All values in `tabiyaConfig` are expected to
 * be Base64-encoded strings.
 *
 * Upon retrieval, this function automatically decodes the Base64 string using `window.atob`.
 * If the variable is missing or any error occurs during decoding, an empty string is returned,
 * and an `EnvError` is logged to the console.
 *
 * Limitations with Unicode Strings:
 * -----------------------------------
 * Since `window.atob` and `window.btoa` only handle binary strings where each character
 * is a single byte (i.e., code points 0–255), this function **cannot natively support
 * Unicode strings** containing characters outside of the Latin-1 character set.
 *
 * If you need to store Unicode (multi-byte) strings in environment variables:
 * - Before setting the variable in `env.js`, encode the Unicode string into a
 *   Base64 string using `TextEncoder` and `Uint8Array` to ensure 1-byte characters.
 * - After retrieving the variable, decode it back using `TextDecoder`.
 *
 * It is the developer's responsibility to perform proper encoding and decoding —
 * this function assumes a Base64-encoded single-byte string and does not handle
 * Unicode conversions.
 *
 * Example: Handling Unicode (e.g., Chinese "好运" = "Good Luck")
 *
 * // Encoding step (run during build time or in your backend config script):
 * const text = "好运"; // Unicode string
 * const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
 * // Set `encoded` as the value in `tabiyaConfig` in env.js
 *
 * // Decoding step (in the frontend, after getEnv):
 * const raw = getEnv("MY_VAR");
 * const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
 * const decoded = new TextDecoder().decode(bytes);
 * console.log(decoded); // "好运"
 *
 * @param key - The name of the environment variable to retrieve.
 * @returns The decoded environment variable value, or an empty string if not found or invalid.
 */
export const getEnv = (key: string) => {
  try {
    // @ts-ignore
    const env = window.tabiyaConfig;
    if (!env?.[key]) {
      return "";
    }
    return window.atob(env[key]);
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

export const ensureRequiredEnvVars = () => {
  requiredEnvVariables.forEach((key: EnvVariables) => {
    if (!getEnv(key)) {
      console.warn(`Required environment variable ${key} is not set`);
    }
  });
};
