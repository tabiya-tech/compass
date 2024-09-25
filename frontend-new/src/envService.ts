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
    console.error("Error loading environment variable", e);
    return "";
  }
};

export const getFirebaseDomain = () => {
  return getEnv("FIREBASE_AUTH_DOMAIN");
};

export const getFirebaseAPIKey = () => {
  return getEnv("FIREBASE_API_KEY");
};

export const getBackendUrl = () => {
  return getEnv("BACKEND_URL");
};

export const getSentryDSN = () => {
  return getEnv("SENTRY_FRONTEND_DSN");
};
