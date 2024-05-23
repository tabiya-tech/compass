import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { CssBaseline, ThemeProvider } from "@mui/material";
import applicationTheme, { ThemeMode } from "./theme/applicationTheme/applicationTheme";

// Currently the fonts are downloaded from Google via the index.css
// Fonts could be distributed with the app instead, by explicitly importing them here

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <CssBaseline />
    <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
