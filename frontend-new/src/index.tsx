import React from "react";
import ReactDOM from "react-dom/client";
import App from "src/app";
import reportWebVitals from "src/reportWebVitals";
import { CssBaseline, ThemeProvider } from "@mui/material";
import applicationTheme, { ThemeMode } from "src/theme/applicationTheme/applicationTheme";
import SnackbarProvider from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineProvider } from "src/app/isOnlineProvider/IsOnlineProvider";
import ViewPortWrapper from "src/app/ViewPortWrapper";

import * as Sentry from "@sentry/react";
import ErrorPage from "src/error/errorPage/ErrorPage";

import { initSentry } from "./sentryInit";
import { ensureRequiredEnvVars } from "./envService";

// initialize react sentry for log aggregation
initSentry();

// Ensure all required environment variables are set
ensureRequiredEnvVars();

export const MAX_WAIT_TIME_FOR_ROOT_ELEMENT = 5000; // it should be greater than the minimum time
                                                    // the loading screen will be shown (see public/index.html)
export const ROOT_ELEMENT_POLL_INTERVAL = 250;
// Wait for the root element to be available in the DOM.
// The root element is added only after the loading screen is removed (see public/index.html).
const waitForRoot = (): Promise<HTMLElement> => {
  const MAX_ATTEMPTS =  MAX_WAIT_TIME_FOR_ROOT_ELEMENT / ROOT_ELEMENT_POLL_INTERVAL;
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let timeoutId: NodeJS.Timeout;

    const checkRoot = () => {
      const rootElement = document.getElementById("root");

      if (rootElement) {
        clearTimeout(timeoutId);
        resolve(rootElement);
        return;
      }

      attempts++;
      if (attempts >= MAX_ATTEMPTS) {
        clearTimeout(timeoutId);
        reject(new Error("Root element not found after maximum attempts"));
        return;
      }

      timeoutId = setTimeout(checkRoot, ROOT_ELEMENT_POLL_INTERVAL);
    };

    checkRoot();
  });
};

// Initialize React after root element is available
waitForRoot()
  .then((rootElement) => {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <Sentry.ErrorBoundary
          fallback={<ErrorPage errorMessage={"Something went wrong with Compass. Try reloading the page..."} />}
        >
          <CssBaseline />
          <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>
            <SnackbarProvider>
              <IsOnlineProvider>
                <ViewPortWrapper>
                  <App />
                </ViewPortWrapper>
              </IsOnlineProvider>
            </SnackbarProvider>
          </ThemeProvider>
        </Sentry.ErrorBoundary>
      </React.StrictMode>,
    );
  })
  .catch((error) => {
    console.error("Failed to initialize React:", error);
  });

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
