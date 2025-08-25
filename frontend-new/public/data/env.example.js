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
      levels: ["error", "warn"], //  Capture only error level logs
    })
  ),
  // The FRONTEND_ENABLE_METRICS variable is picked up by the Metrics SDK.
  FRONTEND_ENABLE_METRICS: btoa("false"),
  SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY: btoa("sensitive-data-encryption-key"),
  SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID: btoa("key_id"),

  // Application default invitation codes.
  // 
  // Authentication Flow Configuration:
  // These 4 flags control the authentication behavior of the application:
  //
  // FRONTEND_LOGIN_CODE: Sets a default invitation code for anonymous login. (Guest login)
  //   - If set, users can click "Continue as Guest" to login anonymously
  //   - If empty, users must use their own invitation code or email/password
  //
  // FRONTEND_REGISTRATION_CODE: Sets a default invitation code for registration.
  //   - If set, users can register with this code without needing their own
  //   - If empty, users must provide their own invitation code to register
  //
  // FRONTEND_DISABLE_LOGIN_CODE: Disables anonymous login functionality.
  //   - If "true", anonymous login is completely disabled regardless of FRONTEND_LOGIN_CODE
  //   - If "false", anonymous login works based on FRONTEND_LOGIN_CODE setting
  //   - When disabled, users can only login with email/password and google
  //
  // FRONTEND_DISABLE_REGISTRATION: Disables user registration entirely.
  //   - If "true", registration page is completely inaccessible (404 error)
  //   - If "false", registration works based on FRONTEND_REGISTRATION_CODE setting
  //   - When disabled, "Register" links are hidden and registration route is removed
  //
  // Common configurations:
  // - Open registration: FRONTEND_DISABLE_REGISTRATION="false", FRONTEND_REGISTRATION_CODE=""
  // - Invitation-only registration: FRONTEND_DISABLE_REGISTRATION="false", FRONTEND_REGISTRATION_CODE="some_code"
  // - Closed registration: FRONTEND_DISABLE_REGISTRATION="true"
  // - Anonymous login enabled: FRONTEND_DISABLE_LOGIN_CODE="false", FRONTEND_LOGIN_CODE="some_code"
  // - Anonymous login disabled: FRONTEND_DISABLE_LOGIN_CODE="true"
  //
  FRONTEND_LOGIN_CODE: btoa("login_code"),
  FRONTEND_REGISTRATION_CODE: btoa("registration_code"),
  FRONTEND_DISABLE_LOGIN_CODE: btoa("false"),
  FRONTEND_DISABLE_REGISTRATION: btoa("false"),

  // Optional features settings.
  FRONTEND_FEATURES: btoa("{}"),
};
