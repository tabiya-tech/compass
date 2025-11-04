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
import { useTranslation } from "react-i18next";

import { initSentry } from "./sentryInit";
import { ensureRequiredEnvVars } from "./envService";

import "./i18n/i18n";

// Error boundary fallback that uses i18n like the rest of the app
const ErrorBoundaryFallback: React.FC = () => {
  const { t } = useTranslation();
  return <ErrorPage errorMessage={t("error_page_default_message")} />;
};

// initialize react sentry for log aggregation
initSentry();

// Ensure all required environment variables are set
ensureRequiredEnvVars();

export const MAX_WAIT_TIME_FOR_ROOT_ELEMENT = 10000; // it should be greater than the minimum time
// the loading screen will be shown (see public/index.html)
export const ROOT_ELEMENT_POLL_INTERVAL = 250;
// Wait for the root element to be available in the DOM.
// The root element is added if the app loads within a certain time frame,
// or after the loading screen has been shown for the minimum required time (see public/index.html),
// whichever happens first.
const waitForRoot = (): Promise<HTMLElement> => {
  const MAX_ATTEMPTS = MAX_WAIT_TIME_FOR_ROOT_ELEMENT / ROOT_ELEMENT_POLL_INTERVAL;
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

function fadeOutAndHide(el: HTMLElement, duration: number) {
  el.style.transition = `opacity ${duration}ms ease`;
  el.style.opacity = "0";
  setTimeout(() => {
    el.style.display = "none";
  }, duration);
}

// Initialize React after root element is available
waitForRoot()
  .then((rootElement) => {
    // At this point, the root element is in the DOM and the loading screen can be hidden.
    const loadingScreen = document.getElementById("loading");
    if (loadingScreen) {
      fadeOutAndHide(loadingScreen, 500);// fade out the loading screen over 500ms
    }
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <Sentry.ErrorBoundary fallback={<ErrorBoundaryFallback />}>
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
