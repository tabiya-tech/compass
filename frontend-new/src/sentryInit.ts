import * as Sentry from "@sentry/react";
import { getBackendUrl, getSentryDSN } from "./envService";
import React from "react";
import anonymizeIP from "ip-anonymize";
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from "react-router-dom";

export function initSentry() {
  Sentry.init({
    dsn: getSentryDSN(),
    integrations: [
      Sentry.browserTracingIntegration(), // performance monitoring by sentry
      Sentry.replayIntegration(), // This will allow errors logged to Sentry to have a video replay of the user's session
      Sentry.feedbackIntegration({
        showBranding: false, // This will hide the Sentry branding
        autoInject: false, // This will disable the automatic injection of the feedback button
        colorScheme: "light", // This will set the color scheme of the feedback form to light
        enableScreenshot: true, // This will enable the screenshot feature
      }), // This will add a feedback button to the side of the page
      Sentry.captureConsoleIntegration({
        levels: ["error"], // depending on dev, test ... you can set this to ["error", "warn", "log", "info", "debug"]
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
    beforeSend(event) {
      // anonymize ip addresses before sending them to sentry
      console.log("Anonymizing IP address", { event }, { user: event.user });
      if(event.user?.ip_address) {
        // mask the last 8 bits of the ipv4 address 192.168.1.16 -> 192.168.1.0
        // mask the last 64 bits of an ipv6 address 2001:4860:4860:1:2:3:4:5 -> 2001:4860:4860:1::
        // if the ip address cant be anonymized, we return undefined to remove it from the event
        const anonymizedIP = anonymizeIP(event.user.ip_address) ?? undefined;
        console.debug(`Anonymized IP address to ${anonymizedIP}`);
        event.user.ip_address = anonymizedIP;
      }
      return event;
    }
  });
}
