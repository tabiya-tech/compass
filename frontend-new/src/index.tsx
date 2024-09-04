import React from "react";
import ReactDOM from "react-dom/client";
import "src/index.css";
import App from "src/app";
import reportWebVitals from "src/reportWebVitals";
import { CssBaseline, ThemeProvider } from "@mui/material";
import applicationTheme, { ThemeMode } from "src/theme/applicationTheme/applicationTheme";
import SnackbarProvider from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineProvider } from "src/app/isOnlineProvider/IsOnlineProvider";
import ViewPortWrapper from "src/app/ViewPortWrapper";

import * as Sentry from "@sentry/react";
import { getBackendUrl, getSentryDSN } from "./envService";
import InternalError from "./errorPage/InternalError";
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from "react-router-dom";

Sentry.init({
  dsn: getSentryDSN(),
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(), // This will allow errors logged to Sentry to have a video replay of the user's session
    Sentry.feedbackIntegration(), // This will add a feedback button to the side of the page
    Sentry.captureConsoleIntegration({
      levels: ["error"],
    }), // This will capture console errors
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect: React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }), // This will add route change information to the event
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", getBackendUrl()], // This will enable distributed tracing for requests to the backend both when the frontend is running locally and in production
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});

// Currently the fonts are downloaded from Google via the index.css
// Fonts could be distributed with the app instead, by explicitly importing them here

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
      <Sentry.ErrorBoundary fallback={<InternalError />}>
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
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
