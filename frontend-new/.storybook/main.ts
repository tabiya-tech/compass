import type { StorybookConfig } from "@storybook/react-webpack5";
import { getEnvConfig } from "./envConfig";

const config: StorybookConfig = {
  // Inject custom script into the preview head
  previewHead: async (head) => {
    return await getEnvConfig(head);
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
    "storybook-react-i18next",
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
