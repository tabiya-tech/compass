const LOAD_TIMEOUT = 3000; // 3 seconds timeout

export const getEnvConfig = async (head: string | undefined = ''): Promise<string> => {
  console.debug('[Storybook EnvConfig] Starting environment configuration setup');
  
  const defaultConfig = {
    "FIREBASE_API_KEY": btoa("some-key"),
    "FIREBASE_AUTH_DOMAIN": btoa("some-domain"),
    "BACKEND_URL": btoa("http://foo.bar.com/api"),
    "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY": btoa("some-key"),
    "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID": btoa("1"),
    "FRONTEND_SENTRY_DSN": btoa("https://foo@bar.sentry.io/baz"),
    "FRONTEND_SENTRY_CONFIG": btoa(JSON.stringify({
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      replayIntegration: false,
      enableLogs: false,
      levels: ["error"]
    })),
    "FRONTEND_ENABLE_CV_UPLOAD": btoa("true")
  };
  // Try to load env.js
  console.debug('[Storybook EnvConfig] Attempting to load env.js');
  
  return `
    ${head}
    <script>
      // Function to handle env.js loading
      function loadEnvConfig() {
        console.debug('[Storybook EnvConfig] Loading env.js...');
        const script = document.createElement('script');
        script.src = '/data/env.js';
        script.onload = () => {
          console.debug('[Storybook EnvConfig] env.js loaded successfully');
          if (window.tabiyaConfig) {
            console.debug('[Storybook EnvConfig] Using configuration from env.js');
          } else {
            console.warn('[Storybook EnvConfig] window.tabiyaConfig not found in env.js, falling back to default config');
            window.tabiyaConfig = ${JSON.stringify(defaultConfig)};
          }
        };
        script.onerror = (error) => {
          console.warn('[Storybook EnvConfig] Failed to load env.js:', error);
          console.debug('[Storybook EnvConfig] Falling back to default configuration');
          window.tabiyaConfig = ${JSON.stringify(defaultConfig)};
          sessionStorage.setItem("ChatSessionID", "1234");
        };
        document.head.appendChild(script);
      }

      // Start loading env.js
      loadEnvConfig();
    </script>
  `;
}; 