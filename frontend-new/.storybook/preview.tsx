import { CssBaseline, ThemeProvider } from "@mui/material";
import React, { Suspense, useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { HashRouter } from "react-router-dom";
import { applicationTheme, ThemeMode } from "../src/theme/applicationTheme/applicationTheme";
// Loading fonts:
//  When the application is built, the fonts are loaded in the index.html file
//  The application font are typically loaded in the index.html but could be loaded from other locations such then index.css or index.tsx.
//  The index.html file using <link> is preferred because it offers faster loading times.
//  For storybook fonts are loaded from here.
//  Any fonts required by the application or by the stories specifically should be loaded by adding an import statement in this file
import "./preview.css";
//  If a fonts used by the application is not referenced in the above file, you can alternatively load it here via @fontsource package e.g.:
//    import "@fontsource/roboto/300.css";
//    import "@fontsource/roboto/400.css";
//    import "@fontsource/roboto/500.css";
//    import "@fontsource/roboto/700.css";
//  If the font references by the application are not loaded via the above mechanism and they are not found locally on the system,
//  the browser will use a default font.

import type { Preview, StoryFn } from "@storybook/react";
import { IsOnlineContext } from "../src/app/isOnlineProvider/IsOnlineProvider";
import { IChatMessage } from "../src/chat/Chat.types";
import { ChatProvider } from "../src/chat/ChatContext";
import i18n from "../src/i18n/i18n";
import { initSentry } from "../src/sentryInit";
import SnackbarProvider from "../src/theme/SnackbarProvider/SnackbarProvider";

const preview: Preview = {
  parameters: {
    i18n,
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
      element: '#storybook-root:not([aria-hidden="true"]), body > div[role="presentation"]',
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
      name: "Sentry Enabled",
      description: "Enable/disable Sentry error reporting",
      toolbar: {
        icon: "alert",
        items: [
          { value: true, title: "Enabled" },
          { value: false, title: "Disabled" },
        ],
      },
    },
    locale: {
      name: 'Locale',
      description: 'Internationalization locale',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'en-gb', title: 'English' },
          { value: 'es-es', title: 'Spanish' },
          { value: 'fr-fr', title: 'French' },
        ],
        showName: true,
      },
    },
  },
  args: {
    online: true,
  },
};

export default preview;

// Store the original FRONTEND_SENTRY_DSN value
// @ts-ignore
const ORIGINAL_SENTRY_DSN = window.tabiyaConfig.FRONTEND_SENTRY_DSN;
let isSentryInitialized = true;

export const decorators = [
  (Story: StoryFn, context: { globals: { online: any; sentryEnabled: boolean; locale?: string } }) => {
    const isOnline = context.globals.online;
    const sentryEnabled = context.globals.sentryEnabled;
    const locale = context.globals.locale || 'en-gb';
    const prevSentryEnabled = React.useRef(sentryEnabled);

    // Handle Sentry enable/disable
     useEffect(() => {
      if (prevSentryEnabled.current !== sentryEnabled) {
        // @ts-ignore
        window.tabiyaConfig.FRONTEND_ENABLE_SENTRY = btoa(sentryEnabled);
        if (sentryEnabled) {
          // @ts-ignore
          window.tabiyaConfig.FRONTEND_SENTRY_DSN = ORIGINAL_SENTRY_DSN;
          initSentry();
          isSentryInitialized = true;
        } else {
          // @ts-ignore
          window.tabiyaConfig.FRONTEND_SENTRY_DSN = undefined;
          isSentryInitialized = false;
          // we have to reload since there is no way to notify the components of this change
          // it is not a provider and the init happens outside of even the react root.render()
          window.location.reload();
        }
        prevSentryEnabled.current = sentryEnabled;
      }
    }, [sentryEnabled]);

    // Handle language changes
    useEffect(() => {
      const handleLanguageChange = (newLocale: string) => {
        document.dir = i18n.dir(newLocale);
      };

      i18n.changeLanguage(locale); // switch to toolbar-selected locale
      i18n.on('languageChanged', handleLanguageChange);

      return () => {
        i18n.off('languageChanged', handleLanguageChange);
      };
    }, [locale]);

    return (
      <HashRouter>
        <IsOnlineContext.Provider value={isOnline}>
          <CssBaseline />
          <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>
            <SnackbarProvider>
              <div style={{ height: "100vh" }}>
                <ChatProvider
                  handleOpenExperiencesDrawer={() => {}}
                    removeMessageFromChat={function (messageId: string): void {
                    throw new Error("Function not implemented.");
                  }}
                  addMessageToChat={function (message: IChatMessage<any>): void {
                    throw new Error("Function not implemented.");
                  }}
                >
                  <Suspense fallback={<div>loading translations...</div>}>
                    <I18nextProvider i18n={i18n}>
                      <Story />
                    </I18nextProvider>
                  </Suspense>
                </ChatProvider>
              </div>
            </SnackbarProvider>
          </ThemeProvider>
        </IsOnlineContext.Provider>
      </HashRouter>
    );
  },
];