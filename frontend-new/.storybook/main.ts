import type { StorybookConfig } from "@storybook/react-webpack5";

const config: StorybookConfig = {
  // Inject custom script into the preview head
  previewHead: (head) => `
    ${head}
    <script>{
      // used for auth components  
      window.tabiyaConfig = {
        "FIREBASE_API_KEY": btoa("some-key"),
        "FIREBASE_AUTH_DOMAIN": btoa("some-domain"),
        "BACKEND_URL": btoa("http://foo.bar.com/api")
      };
      //used for chat components
      sessionStorage.setItem("ChatSessionID", "1234")
    }
    </script>
  `,
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
