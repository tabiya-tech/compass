import * as Sentry from "@sentry/react";
import { createTransport, type Transport,  type TransportRequest, type TransportMakeRequestResponse } from "@sentry/core";
import { getBackendUrl, getSentryConfig, getSentryDSN, getSentryEnabled, getTargetEnvironmentName } from "./envService";
import React from "react";
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from "react-router-dom";
import { serializeError } from "./error/errorSerializer";
import InfoService from "./info/info.service";
import AuthenticationStateService from "./auth/services/AuthenticationState.service";
import UserPreferencesStateService from "./userPreferences/UserPreferencesStateService";
import UserPreferencesService from "./userPreferences/UserPreferencesService/userPreferences.service";
import { ConsoleLevel } from "@sentry/core/build/types/types-hoist/instrument";
import brotliPromise from "brotli-wasm";

export interface SentryConfig {
  // See https://docs.sentry.io/platforms/javascript/configuration/options/
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  replayIntegration: boolean;
  enableLogs: boolean; // See: https://docs.sentry.io/platforms/javascript/guides/react/logs/
  levels: string[];
  logLevels: string[];
}

export const SENTRY_CONFIG_DEFAULT: SentryConfig = {
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  replaysSessionSampleRate: 0, // 0% of sessions will be replayed
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors will be replayed
  replayIntegration: false, //  Turn off replay integration to reduce bundle size
  enableLogs: false, // Enable logs to be sent to Sentry, this depends on the 'levels' configuration
  levels: ["error"], //  Capture only error level logs
  logLevels: ["error", "warn", "info"], // Capture error, warn and info levels logs
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
      enableLogs: _config?.enableLogs ?? SENTRY_CONFIG_DEFAULT.enableLogs,
      levels: _config?.levels ?? SENTRY_CONFIG_DEFAULT.levels,
      logLevels: _config?.logLevels ?? SENTRY_CONFIG_DEFAULT.logLevels,
    },
    errors: errors,
    warnings: warnings,
  };
}

function obfuscateEvent<T>(event: T): T {
  try {
    // Stringify the event and replace 'auth' with 'htua' to avoid Sentry from filtering our auth module logs.
    // Replace 'token' with 't0ken' to avoid Sentry from filtering logs related to the token.
    // For the list of fields ignored, see: https://docs.sentry.io/security-legal-pii/scrubbing/server-side-scrubbing/
    event = JSON.parse(JSON.stringify(event).replace(/auth/gi, "htua").replace(/oken/gi, "0ken"));
  } catch (e) {} // If the event cannot be stringifies, we just ignore the error

  return event;
}

export class CompressionError extends Error {
  constructor(message: string, cause?: any) {
    super(message, { cause });
    this.name = "CompressionError";
  }
}

/**
 * Custom transport to send events to Sentry.
 * This is created because we want
 * 1. to compress sentry requests before sending them.
 *
 * docs: https://docs.sentry.io/platforms/javascript/guides/react/configuration/transports/
 */
export function sentryTransport(options: any): Transport {
  /**
   * Function Callback function to make the request to sentry
   * @param request
   */
  async function makeRequest(request: TransportRequest) {
    // Compress the request body and add the appropriate headers.
    const rawBytes = typeof request.body === "string" ? new TextEncoder().encode(request.body) : request.body;

    let requestBody, contentEncoding;
    try {
      const brotli = await brotliPromise;
      requestBody = brotli.compress(rawBytes);
      contentEncoding = "br";
    } catch (e) {
      console.error(new CompressionError("Error compressing Sentry request body, sending uncompressed", e));
      // If an error compressing the body, we just send the uncompressed body
      requestBody = rawBytes;
      contentEncoding = undefined
    }

    const requestOptions: RequestInit = {
      // Don't worry about the gain, Sentry payloads are usually large,
      body: requestBody,
      method: "POST",
      headers: {
        ...(options.headers || {}),
        "Content-Encoding": contentEncoding,
      },
      ...options.fetchOptions
    };

    // Make the request to Sentry (options.url = dsn) using custom fetch
    const response = await fetch(options.url, requestOptions);

    // Return the status code, and the rate limit headers to Sentry
    let result: TransportMakeRequestResponse = {
      statusCode: response.status,
      headers: {
        // Sentry uses these headers to determine rate limits
        // We are forwarding the headers from the response to Sentry
        // So that sentry will internally handle retries, backoff, etc.
        // See https://docs.sentry.io/api/ratelimits/#headers
        "x-sentry-rate-limits": response.headers.get("X-Sentry-Rate-Limits"),
        "retry-after": response.headers.get("Retry-After"),
      },
    }

    return result
  }

  // Return the transport created with the custom makeRequest function
  return createTransport(options, makeRequest);
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

  // This will allow JavaScript console object functions (console.log, console.error, console.warn, etc) to send logs to Sentry
  if (cfg.enableLogs) {
    integrations.push(
      Sentry.consoleLoggingIntegration({
        levels: cfg.logLevels as ConsoleLevel[],
      })
    );
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

    // Logs
    enableLogs: cfg.enableLogs,

    // Custom transport.
    transport: sentryTransport,

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
          session_id: UserPreferencesStateService.getInstance().getActiveSessionId(),
        };
      }

      return obfuscateEvent(event);
    },
    beforeSendLog(log) {
      log.attributes = {
        ...(log.attributes || {}),
        client_id: UserPreferencesService.getInstance().getClientID(),
        user_id: AuthenticationStateService.getInstance().getUser()?.id,
        session_id: UserPreferencesStateService.getInstance().getActiveSessionId(),
        component_name: "brujula-frontend"
      };

      return obfuscateEvent(log);
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
  Sentry.setTag("client_id", UserPreferencesService.getInstance().getClientID());

  // Log any errors and warning that occurred while loading Sentry
  // Do this at the end, so that if entry is initialized, the errors are sent to Sentry
  warnings.forEach((w) => console.warn(`Warning loading Sentry: ${w}`));
  errors.forEach((e) => console.error(`Error loading Sentry: ${e.message}`, e));
}
