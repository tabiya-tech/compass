console.log("env.js loaded.....");
window.tabiyaConfig = {
  ADMIN_FRONTEND_FIREBASE_API_KEY: btoa("your-api-key"),
  ADMIN_FRONTEND_FIREBASE_AUTH_DOMAIN: btoa("auth-domain"),
  ADMIN_FRONTEND_FIREBASE_TENANT_ID: btoa("tenant-id"),
  ADMIN_FRONTEND_FIREBASE_PROJECT_ID: btoa("your-project-id"),
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

  // ################################################################
  // #       Locales
  // ################################################################
  // Default locale (used as initial UI language if user preference not set)
  FRONTEND_DEFAULT_LOCALE: btoa("en-US"),
  FRONTEND_SUPPORTED_LOCALES: btoa(JSON.stringify(["en-US", "es-US"])),

  // ################################################################
  // #       Branding Settings
  // ################################################################
  LEGAL_SITE_BASE_URL: btoa("https://foo.bar"),
  GLOBAL_PRODUCT_NAME: btoa("Compass Admin"),
  FRONTEND_BROWSER_TAB_TITLE: btoa("Compass Admin"),
  FRONTEND_META_DESCRIPTION: btoa("Compass Admin Portal - Manage and configure Compass platform settings."),
  FRONTEND_LOGO_URL: btoa("/logo.svg"),
  FRONTEND_MINISTRY_URL: btoa("/ministry-tech.png"),
  FRONTEND_FAVICON_URL: btoa("/logo.svg"),
  FRONTEND_APP_ICON_URL: btoa("/logo.svg"),
  // Override platform colours — see src/styles/variables.css for all available keys. Values are RGB triplets, e.g. "239 123 0".
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
