console.log('env.js loaded.....');
window.tabiyaConfig = {
  "FIREBASE_API_KEY": btoa("Some API Key"),
  "FIREBASE_AUTH_DOMAIN": btoa("someAuthDomain"), // auth domain. auth.<env-name>.<realm-name>.<base-domain-name>
  "BACKEND_URL": btoa("https://foo.bar/api"),
  // The SENTRY_DSN variable is picked up by the Sentry SDK.
  // It's used for error tracking.
  "SENTRY_FRONTEND_DSN": btoa("https://foo@bar.sentry.io/baz"),
  // The SENTRY_AUTH_TOKEN variable is picked up by the Sentry Build Plugin.
  // It's used for authentication when uploading source maps.
  "SENTRY_AUTH_TOKEN":btoa("Some Auth Token"),
  "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY": btoa("sensitive-data-encryption-key"),
  "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID": btoa("key_id"),
};
