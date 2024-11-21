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
import ErrorPage from "src/error/errorPage/ErrorPage";

import { initSentry } from "./sentryInit";
import { ensureRequiredEnvVars } from "./envService";

// initialize react sentry for log aggregation
initSentry();

// Ensure all required environment variables are set
ensureRequiredEnvVars();

// Currently the fonts are downloaded from Google via the index.css
// Fonts could be distributed with the app instead, by explicitly importing them here

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  //<React.StrictMode>
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
  //</React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
