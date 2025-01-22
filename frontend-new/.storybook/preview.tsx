import React, { useEffect } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { HashRouter } from "react-router-dom";
import { applicationTheme, ThemeMode } from "../src/theme/applicationTheme/applicationTheme";
// Load fonts
// The application font are typically loaded in the index.html, index.css or index.tsx file
// The fonts for the storybook are loaded here
// Since the fonts for the app are downloaded from a CDN in the index.css file
// we need to load them here as well
import "../src/index.css";
// Load the application theme css file here
import "../src/theme/applicationTheme/application-theme.css";
// If the application fonts are loaded from the index.tsx file via an import, then the fonts can be loaded here as well
/*
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
*/
import type { Preview, StoryFn, StoryObj } from "@storybook/react";
import SnackbarProvider from "../src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineContext } from "../src/app/isOnlineProvider/IsOnlineProvider";
import { initSentry } from "../src/sentryInit";

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
      // Storybook will run the a11y tests on the element with this selector.
      // By default, a11y tests are run on the #storybook-root.
      // However, some modal or dialog components are not rendered as a child of the #storybook-root.
      // In such cases, the a11y tests will not be able to find the modal or dialog components.
      // The selector below will allow the a11y tests on the #storybook-root or the root element of the modal or dialog,
      // depending on which element is not hidden.
      // Unfortunately, the axe-core library does not support running a11y tests on multiple elements,
      // so it is important that the selector returns only one element.
      // An alternative to this would have been to use the `body` element to run the a11y tests on that,
      // but this does not work well because it reports false positives and false negatives.
      // The same selector is used in the `a11y` parameter in the `test-runner.js` file.
      element: "#storybook-root:not([aria-hidden=\"true\"]), body > div[role=\"presentation\"]",
    },
  },
  globalTypes: {
    online: {
      name: "Online",
      description: "Is the user online",
      toolbar: {
        icon: "rss",
        items: [
          { value: true, title: "Online" },
          { value: false, title: "Offline" },
        ],
        dynamicTitle: true,
      },
    },
    sentryEnabled: {
      name: 'Sentry Enabled',
      description: 'Enable/disable Sentry error reporting',
      toolbar: {
        icon: 'alert',
        items: [
          {value: true, title: 'Enabled'},
          {value: false, title: 'Disabled'},
        ],
      },
    },
  },
  args: {
    online: true,
  },
};

export default preview;

// Store the original SENTRY_FRONTEND_DSN value
// @ts-ignore
const ORIGINAL_SENTRY_DSN = window.tabiyaConfig.SENTRY_FRONTEND_DSN;
let isSentryInitialized = true;

export const decorators = [
  ( Story: StoryFn, context: { globals: { online: any; sentryEnabled: boolean; }; }) => {
  const isOnline = context.globals.online;
  const sentryEnabled = context.globals.sentryEnabled;
  const prevSentryEnabled = React.useRef(sentryEnabled);

  useEffect(() => {
    if (prevSentryEnabled.current !== sentryEnabled) {
      if (sentryEnabled) {
        // @ts-ignore
        window.tabiyaConfig.SENTRY_FRONTEND_DSN = ORIGINAL_SENTRY_DSN;
        initSentry();
        isSentryInitialized = true;
      } else {
        // @ts-ignore
        window.tabiyaConfig.SENTRY_FRONTEND_DSN = undefined;
        isSentryInitialized = false;
        // we have to reload since there is no way to notify the components of this change
        // it is not a provider and the init happens outside of even the react root.render()
        window.location.reload();
      }
      prevSentryEnabled.current = sentryEnabled;
    }
  }, [sentryEnabled]);

  return (
    <HashRouter>
      <IsOnlineContext.Provider value={isOnline}>
        <CssBaseline />
          <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>
            <SnackbarProvider>
              <div style={{ height: "100vh" }}>
                <Story />
              </div>
            </SnackbarProvider>
          </ThemeProvider>
      </IsOnlineContext.Provider>
    </HashRouter>
    );
  }
];
