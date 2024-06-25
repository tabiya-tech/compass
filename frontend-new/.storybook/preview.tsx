import { CssBaseline, ThemeProvider } from "@mui/material";
import { BrowserRouter as Router } from "react-router-dom";
import { applicationTheme, ThemeMode } from "../src/theme/applicationTheme/applicationTheme";
// Load fonts
import "../src/index.css";
import "../src/theme/applicationTheme/application-theme.css";
// If the application fonts are loaded from the index.tsx file via an import, then the fonts can be loaded here as well
/*
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
*/
import type { Preview } from "@storybook/react";
import { AuthProvider } from "../src/auth/AuthProvider";
import SnackbarProvider from "../src/theme/SnackbarProvider/SnackbarProvider";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    layout: "fullscreen",
    a11y: {
      element: '#storybook-root:not([aria-hidden="true"]), body > div[role="presentation"]',
    },
  },
};

export default preview;

// Define the sessionStorage decorator
const withSessionStorage = (Story) => {
  // Set the sessionStorage before rendering the stories (used for chat components)
  sessionStorage.setItem('ChatSessionID', '1234');
  return <Story />;
};

export const decorators = [
  withSessionStorage,  // Add the sessionStorage decorator
  (Story) => (
    <Router>
      <AuthProvider>
        <CssBaseline />
        <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>
          <SnackbarProvider>
            <div style={{ height: "100vh" }}>
              <Story />
            </div>
          </SnackbarProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  ),
];
