import type { StorybookConfig } from "@storybook/react-webpack5";
import { exportCryptoPublicKey, generateRSACryptoPairKey } from "../src/_test_utilities/encryption";

const config: StorybookConfig = {
  // Inject custom script into the preview head
  previewHead: async (head) => {
    const key = await exportCryptoPublicKey((await generateRSACryptoPairKey(2048)).publicKey)
    return `
    ${head}
    <script>{
      // used for auth components  
      window.tabiyaConfig = {
        "FIREBASE_API_KEY": btoa("some-key"),
        "FIREBASE_AUTH_DOMAIN": btoa("some-domain"),
        "BACKEND_URL": btoa("http://foo.bar.com/api"),
        "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY": btoa(\`${key}\`),
        "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID": btoa("1"),
        "FRONTEND_SENTRY_DSN": btoa("https://foo@bar.sentry.io/baz")
      };
      //used for chat components
      sessionStorage.setItem("ChatSessionID", "1234")
    }
    </script>
  `
  },
  // Define story locations
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx)"],
  // Addons for additional functionality
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/preset-create-react-app",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
    "@storybook/addon-styling-webpack",
    "@storybook/addon-themes",
    "storybook-addon-mock",
  ],
  // Framework configuration
  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },
  // Documentation configuration
  docs: {
    autodocs: "tag",
  },
  // Specify static directories
  staticDirs: ["../public"],
};

export default config;
