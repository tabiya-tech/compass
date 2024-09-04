console.log('env.js loaded.....');
window.tabiyaConfig = {
  "FIREBASE_API_KEY": btoa("Some API Key"),
  "FIREBASE_AUTH_DOMAIN": btoa("someAuthDomain"), // auth domain without the ".firebaseapp.com"
  "BACKEND_URL": btoa("https://foo.bar/api"),
  // The SENTRY_DSN variable is picked up by the Sentry SDK.
  // It's used for error tracking.
  "SENTRY_DSN": btoa("https://foo.bar/dsn"),
  // The SENTRY_AUTH_TOKEN variable is picked up by the Sentry Build Plugin.
  // It's used for authentication when uploading source maps.
  "SENTRY_AUTH_TOKEN":btoa("Some Auth Token"),
};