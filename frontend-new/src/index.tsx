import React from "react";
import ReactDOM from "react-dom/client";
import "src/index.css";
import App from "src/app";
import reportWebVitals from "src/reportWebVitals";
import { CssBaseline, ThemeProvider } from "@mui/material";
import applicationTheme, { ThemeMode } from "src/theme/applicationTheme/applicationTheme";
import { AuthProvider } from "src/auth/AuthProvider/AuthProvider";
import SnackbarProvider from "src/theme/SnackbarProvider/SnackbarProvider";
import { UserPreferencesProvider } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { IsOnlineProvider } from "src/app/isOnlineProvider/IsOnlineProvider";
import ViewPortWrapper from "src/app/ViewPortWrapper";
import { HashRouter } from "react-router-dom";
import { InvitationsProvider } from "./invitations/InvitationsProvider/InvitationsProvider";

// Currently the fonts are downloaded from Google via the index.css
// Fonts could be distributed with the app instead, by explicitly importing them here

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  // <React.StrictMode>
  <>
    <CssBaseline />
    <IsOnlineProvider>
      <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>
        <AuthProvider>
          <UserPreferencesProvider>
            <InvitationsProvider>
              <SnackbarProvider>
                <ViewPortWrapper>
                  <HashRouter>
                    <App />
                  </HashRouter>
                </ViewPortWrapper>
              </SnackbarProvider>
            </InvitationsProvider>
          </UserPreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
    </IsOnlineProvider>
  </>
  // </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
