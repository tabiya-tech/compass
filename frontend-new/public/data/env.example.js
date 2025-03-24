console.log('env.js loaded.....');
window.tabiyaConfig = {
  "FIREBASE_API_KEY": btoa("Some API Key"),
  "FIREBASE_AUTH_DOMAIN": btoa("someAuthDomain"), // auth domain. auth.<env-name>.<realm-name>.<base-domain-name>
  "BACKEND_URL": btoa("https://foo.bar/api"),
  "TARGET_ENVIRONMENT_NAME": btoa("local"),
  // The SENTRY_DSN variable is picked up by the Sentry SDK.
  // It's used for error tracking.
  "FRONTEND_ENABLE_SENTRY": btoa("False"),
  "FRONTEND_SENTRY_DSN": btoa("https://foo@bar.sentry.io/baz"),
  // The FRONTEND_ENABLE_METRICS variable is picked up by the Metrics SDK.
  "FRONTEND_ENABLE_METRICS": btoa("False"),
  // The SENTRY_AUTH_TOKEN variable is picked up by the Sentry Build Plugin.
  // It's used for authentication when uploading source maps.
  "SENTRY_AUTH_TOKEN":btoa("Some Auth Token"),
  "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY": btoa("sensitive-data-encryption-key"),
  "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID": btoa("key_id"),
};
