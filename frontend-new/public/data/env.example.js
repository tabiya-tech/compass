console.log('env.js loaded.....');
window.tabiyaConfig = {
  "FIREBASE_API_KEY": btoa("Some API Key"),
  "FIREBASE_AUTH_DOMAIN": btoa("someAuthDomain"), // auth domain. auth.<env-name>.<realm-name>.<base-domain-name>
  "BACKEND_URL": btoa("https://foo.bar/api"),
  "TARGET_ENVIRONMENT_NAME": btoa("local"),
  // The SENTRY_DSN variable is picked up by the Sentry SDK.
  // It's used for error tracking.
  "FRONTEND_ENABLE_SENTRY": btoa("true"),
  "FRONTEND_SENTRY_DSN": btoa("https://foo@bar.sentry.io/baz"),
  "FRONTEND_SENTRY_CONFIG": btoa(JSON.stringify(
    {
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      replaysSessionSampleRate: 0, // 0% of sessions will be replayed
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors will be replayed
      replayIntegration: false, //  Turn off replay integration to reduce bundle size
      levels: ["error", "warn"], //  Capture only error level logs
    }
  )),
  // The FRONTEND_ENABLE_METRICS variable is picked up by the Metrics SDK.
  "FRONTEND_ENABLE_METRICS": btoa("false"),
  "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY": btoa("sensitive-data-encryption-key"),
  "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID": btoa("key_id"),

  // Application default invitation codes.
  "FRONTEND_LOGIN_CODE": btoa("login_code"),
  "FRONTEND_REGISTRATION_CODE": btoa("registration_code"),

  // Optional features settings.
  "FRONTEND_FEATURES": btoa('{}')
};
