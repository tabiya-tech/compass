import * as Sentry from "@sentry/react";
import { getBackendUrl, getSentryConfig, getSentryDSN, getSentryEnabled, getTargetEnvironmentName } from "./envService";
import React from "react";
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from "react-router-dom";
import { serializeError } from "./error/errorSerializer";
import InfoService from "./info/info.service";
import AuthenticationStateService from "./auth/services/AuthenticationState.service";
import UserPreferencesStateService from "./userPreferences/UserPreferencesStateService";
import UserPreferencesService from "./userPreferences/UserPreferencesService/userPreferences.service";

export interface SentryConfig {
  // See https://docs.sentry.io/platforms/javascript/configuration/options/
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  replayIntegration: boolean;
  levels: string[];
}

export const SENTRY_CONFIG_DEFAULT: SentryConfig = {
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  replaysSessionSampleRate: 0, // 0% of sessions will be replayed
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors will be replayed
  replayIntegration: false, //  Turn off replay integration to reduce bundle size
  levels: ["error"], //  Capture only error level logs
};

export interface SentryConfigResult {
  dsn: string;
  enabled: boolean;
  cfg: SentryConfig;
  errors: Error[];
  warnings: string[];
}

export function loadSentryConfig(): SentryConfigResult {
  const errors = [];
  const warnings = [];
  const enabled = getSentryEnabled().toLowerCase() === "true";
  const dsn = getSentryDSN();
  if (enabled && !dsn) {
    errors.push(new Error("Sentry is enabled but DSN is not available"));
  }
  let _config: Partial<SentryConfig> = {};
  try {
    const _config_json = getSentryConfig();
    if (_config_json) {
      _config = JSON.parse(_config_json);
    } else {
      warnings.push("Sentry config is not available, reverting to default config");
    }
  } catch (e) {
    errors.push(new Error("Error parsing Sentry config JSON, reverting to default config", { cause: e }));
  }
  return {
    dsn: dsn,
    enabled: enabled,
    cfg: {
      tracesSampleRate: _config?.tracesSampleRate ?? SENTRY_CONFIG_DEFAULT.tracesSampleRate,
      replaysSessionSampleRate: _config?.replaysSessionSampleRate ?? SENTRY_CONFIG_DEFAULT.replaysSessionSampleRate,
      replaysOnErrorSampleRate: _config?.replaysOnErrorSampleRate ?? SENTRY_CONFIG_DEFAULT.replaysOnErrorSampleRate,
      replayIntegration: _config?.replayIntegration ?? SENTRY_CONFIG_DEFAULT.replayIntegration,
      levels: _config?.levels ?? SENTRY_CONFIG_DEFAULT.levels,
    },
    errors: errors,
    warnings: warnings,
  };
}

export function initSentry() {
  // Load Sentry configuration
  const { dsn, enabled, cfg, errors, warnings } = loadSentryConfig();

  if (!enabled) {
    console.info("Sentry is not enabled. Sentry will not be initialized.");
    return;
  }
  if (!dsn) {
    console.warn("Sentry is enabled but DSN is not available. Sentry will not be initialized.");
    return;
  }
  console.info("Initializing Sentry");
  // Initialize the standard integrations
  const integrations: any[] = [
    // Browser monitoring and tracing
    Sentry.browserTracingIntegration(),
    // This will add a feedback button to the side of the page
    Sentry.feedbackIntegration({
      showBranding: false, // This will hide the Sentry branding
      autoInject: false, // This will disable the automatic injection of the feedback button
      colorScheme: "light", // This will set the color scheme of the feedback form to light
      enableScreenshot: true, // This will enable the screenshot feature
    }),
    // This will capture console errors
    Sentry.captureConsoleIntegration({
      levels: cfg.levels,
    }),
    // This will add route change information to the event
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect: React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
  ];
  // This will allow errors logged to Sentry to have a video replay of the user's session
  if (cfg.replayIntegration) {
    integrations.push(Sentry.replayIntegration());
  }
  Sentry.init({
    dsn: dsn,
    environment: getTargetEnvironmentName(),
    integrations: integrations,
    // Tracing
    tracesSampleRate: cfg.tracesSampleRate,
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ["localhost", getBackendUrl()], // This will enable distributed tracing for requests to the backend both when the frontend is running locally and in production
    // Session Replay
    replaysSessionSampleRate: cfg.replaysSessionSampleRate, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: cfg.replaysOnErrorSampleRate, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    // Add the beforeSend callback to modify the event before sending it
    beforeSend(event, hint) {
      // This will add the error details to the extra field of the event
      const originalError = hint?.originalException;
      if (originalError && typeof originalError === "object") {
        const serialized = serializeError(originalError);
        // Attach the entire structure to extra for inspection
        event.extra = {
          ...event.extra,
          errorDetails: serialized,
        };
        event.tags = {
          ...event.tags,
          user_id: AuthenticationStateService.getInstance().getUser()?.id,
          session_id: UserPreferencesStateService.getInstance().getActiveSessionId()
        }
      }

      try {
        // Stringify the event and replace 'auth' with 'htau' to avoid Sentry from filtering our auth module logs.
        // Replace 'token' with 't0ken' to avoid Sentry from filtering logs related to the token.
        // For the list of fields ignored, see: https://docs.sentry.io/security-legal-pii/scrubbing/server-side-scrubbing/
        event = JSON.parse(JSON.stringify(event)
          .replace(/auth/gi, "htau")
          .replace(/oken/gi, "0ken"));
      } catch (e) {} // If the event cannot be stringifies, we just ignore the error

      return event;
    },
  });
  InfoService.getInstance()
    .loadInfo()
    .then(({ frontend }) => {
      // Set the frontend version in Sentry
      // @ts-ignore
      Sentry.setContext("Frontend Version", frontend);
    });

  // Set the tag for the client ID in Sentry, It is not per event, but per session.
  Sentry.setTag("client_id", UserPreferencesService.getInstance().getClientID())

  // Log any errors and warning that occurred while loading Sentry
  // Do this at the end, so that if entry is initialized, the errors are sent to Sentry
  warnings.forEach((w) => console.warn(`Warning loading Sentry: ${w}`));
  errors.forEach((e) => console.error(`Error loading Sentry: ${e.message}`, e));
}
