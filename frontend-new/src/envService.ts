import { EnvError } from "./error/commonErrors";
export enum EnvVariables {
  FIREBASE_AUTH_DOMAIN = "FIREBASE_AUTH_DOMAIN",
  FIREBASE_API_KEY = "FIREBASE_API_KEY",
  BACKEND_URL = "BACKEND_URL",
  SENTRY_FRONTEND_DSN = "SENTRY_FRONTEND_DSN",
  SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY = "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY",
  SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID = "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID",
}

export const requiredEnvVariables = [
  EnvVariables.FIREBASE_AUTH_DOMAIN,
  EnvVariables.FIREBASE_API_KEY,
  EnvVariables.BACKEND_URL,
  EnvVariables.SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY,
  EnvVariables.SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID,
];

export const getEnv = (key: string) => {
  // This is a global variable that is set by the env.js module loaded in the index.html
  // This method can be used synchronously to get the value of an environment variable anywhere in the frontend code
  try {
    // @ts-ignore
    const env = window.tabiyaConfig;
    if (!env?.[key]) {
      return "";
    }
    return window.atob(env[key]);
  } catch (e) {
    console.error(new EnvError(`Error loading environment variable ${key}`, e as Error));
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
  return getEnv(EnvVariables.SENTRY_FRONTEND_DSN);
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
