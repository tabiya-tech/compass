console.log("env.js loaded.....");
window.tabiyaConfig = {
  FIREBASE_API_KEY: btoa("Some API Key"),
  FIREBASE_AUTH_DOMAIN: btoa("someAuthDomain"), // auth domain. auth.<env-name>.<realm-name>.<base-domain-name>
  BACKEND_URL: btoa("https://foo.bar/api"),
  TARGET_ENVIRONMENT_NAME: btoa("local"),
  // The SENTRY_DSN variable is picked up by the Sentry SDK.
  // It's used for error tracking.
  FRONTEND_ENABLE_SENTRY: btoa("true"),
  FRONTEND_SENTRY_DSN: btoa("https://foo@bar.sentry.io/baz"),
  FRONTEND_SENTRY_CONFIG: btoa(
    JSON.stringify({
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      replaysSessionSampleRate: 0, // 0% of sessions will be replayed
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors will be replayed
      replayIntegration: false, //  Turn off replay integration to reduce bundle size
      enableLogs: false, // Turn on/off sending logs to sentry
      levels: ["error", "warn"], //  Capture only error level logs
      logLevels: ["error", "warn", "info"], //  Capture error, warn and info levels logs
    })
  ),
  // The FRONTEND_ENABLE_METRICS variable is picked up by the Metrics SDK.
  FRONTEND_ENABLE_METRICS: btoa("false"),
  FRONTEND_METRICS_CONFIG: btoa(
    JSON.stringify({
      flushIntervalMs: 15000, // Interval (in ms) at which metrics are flushed.
      events: {  // Turn on/off specific events
        CV_DOWNLOADED: { enabled: true },
        DEMOGRAPHICS: { enabled: true },
        USER_LOCATION: { enabled: true },
        DEVICE_SPECIFICATION: { enabled: true },
        NETWORK_INFORMATION: { enabled: true },
        UI_INTERACTION: { enabled: true }
      }
    })
  ),

  SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY: btoa("sensitive-data-encryption-key"),
  SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID: btoa("key_id"),

  // ################################################################
  // #       Locales
  // ################################################################
  // Default locale (used as initial UI language if user preference not set)
  FRONTEND_DEFAULT_LOCALE: btoa("en-US"),
  FRONTEND_SUPPORTED_LOCALES: btoa(JSON.stringify(["en-US","es-US"])),

  // ################################################################
  // #       Auth Settings.
  // ################################################################
  FRONTEND_DISABLE_LOGIN_CODE: btoa("false"),
  FRONTEND_DISABLE_REGISTRATION: btoa("false"),
  FRONTEND_DISABLE_SOCIAL_AUTH: btoa("false"),
  FRONTEND_LOGIN_CODE: btoa("login_code"),
  FRONTEND_REGISTRATION_CODE: btoa("registration_code"),

  // CV Upload feature flag (optional, defaults to false if not set)
  FRONTEND_ENABLE_CV_UPLOAD: btoa("true"),

  // Optional features settings.
  // ################################################################
  // #       Optional Features settings
  // ################################################################
  FRONTEND_FEATURES: btoa("{}"),

  // ################################################################
  // #       Branding Settings
  // ################################################################
  GLOBAL_PRODUCT_NAME: btoa("Compass"),
  FRONTEND_BROWSER_TAB_TITLE: btoa("Compass"),
  FRONTEND_META_DESCRIPTION: btoa("Welcome to Compass! An AI-powered career assistant that helps jobseekers identify and showcase their skills."),
  FRONTEND_SEO: btoa(
    JSON.stringify({
      name: "Compass",
      url: "https://www.example.org/compass",
      image: "https://www.example.org/assets/logo.svg",
      description: "Compass is an AI-powered career assistant that helps jobseekers discover and describe their skills.",
    })
  ),
  FRONTEND_LOGO_URL: btoa("/logo.svg"),
  FRONTEND_FAVICON_URL: btoa("/favicon.svg"),
  FRONTEND_APP_ICON_URL: btoa("/compass.svg"),
  FRONTEND_THEME_CSS_VARIABLES: btoa(
    JSON.stringify({
      "brand-primary": "0 255 145",
      "brand-primary-light": "51 255 167",
      "brand-primary-dark": "0 178 101",
      "brand-primary-contrast-text": "0 0 0",
      "brand-secondary": "30 113 102",
      "brand-secondary-light": "77 154 143",
      "brand-secondary-dark": "21 79 71",
      "brand-secondary-contrast-text": "0 0 0",
      "text-primary": "0 33 71",
      "text-secondary": "65 64 61",
      "text-accent": "38 94 167",
    })
  ),
};
