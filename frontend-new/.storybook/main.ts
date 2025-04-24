import type { StorybookConfig } from "@storybook/react-webpack5";
import { exportCryptoPublicKey, generateRSACryptoPairKey } from "../src/_test_utilities/encryption";

const config: StorybookConfig = {
  // Inject custom script into the preview head
  previewHead: async (head) => {
    const key = await exportCryptoPublicKey((await generateRSACryptoPairKey(2048)).publicKey)
    return `
    ${head}
    <!-- loading the env.js from the public directory here so that storybook has access to all the environment variables-->
    <script defer src="/data/env.js"></script>
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
