import "src/_test_utilities/consoleMock";

import * as Sentry from "@sentry/react";
import { initSentry } from "./sentryInit";
import { getBackendUrl, getSentryDSN } from "./envService";
import * as EnvServiceModule from "./envService";

// Mock all the required dependencies
jest.mock("@sentry/react", () => ({
  init: jest.fn(),
  browserTracingIntegration: jest.fn(),
  replayIntegration: jest.fn(),
  feedbackIntegration: jest.fn(),
  captureConsoleIntegration: jest.fn(),
  reactRouterV6BrowserTracingIntegration: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock("./envService", () => ({
  getBackendUrl: jest.fn(),
  getTargetEnvironmentName: jest.fn(),
  getSentryDSN: jest.fn(),
}));

describe("sentryInit", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock returns
    (getSentryDSN as jest.Mock).mockReturnValue("mock-dsn");
    (getBackendUrl as jest.Mock).mockReturnValue("https://api.example.com");
  });

  test("should not initialize Sentry if DSN is not available", () => {
    // GIVEN the DSN is not available
    (getSentryDSN as jest.Mock).mockReturnValue("");

    // WHEN initSentry is called
    initSentry();

    // THEN expect Sentry.init not to be called
    expect(Sentry.init).not.toHaveBeenCalled();

    // AND log a warning message
    expect(console.warn).toHaveBeenCalledWith("Sentry DSN is not available. Sentry will not be initialized.");
  });

  test("should initialize Sentry with correct configuration", () => {
    // GIVEN the necessary configuration values are available
    const mockBrowserTracing = { name: "browserTracing" };
    const mockFeedback = { name: "feedback" };
    const mockConsole = { name: "console" };
    const mockRouter = { name: "router" };

    const givenTargetEnvironmentName = "given-target-environment-name";

    (Sentry.browserTracingIntegration as jest.Mock).mockReturnValue(mockBrowserTracing);
    (Sentry.feedbackIntegration as jest.Mock).mockReturnValue(mockFeedback);
    (Sentry.captureConsoleIntegration as jest.Mock).mockReturnValue(mockConsole);
    (Sentry.reactRouterV6BrowserTracingIntegration as jest.Mock).mockReturnValue(mockRouter);
    (EnvServiceModule.getTargetEnvironmentName as jest.Mock).mockReturnValue(givenTargetEnvironmentName);

    // WHEN initSentry is called
    initSentry();

    // THEN expect Sentry.init to be called with the correct configuration
    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: "mock-dsn",
      environment: givenTargetEnvironmentName,
      integrations: [
        mockBrowserTracing,
        expect.objectContaining({
          name: "feedback",
        }),
        expect.objectContaining({
          name: "console",
        }),
        mockRouter,
      ],
      tracesSampleRate: 1.0,
      tracePropagationTargets: ["localhost", "https://api.example.com"],
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0
    });
  });

  test("should configure feedback integration with correct options", () => {
    // WHEN initSentry is called
    initSentry();

    // THEN expect feedbackIntegration to be called with correct options
    expect(Sentry.feedbackIntegration).toHaveBeenCalledWith({
      showBranding: false,
      autoInject: false,
      colorScheme: "light",
      enableScreenshot: true,
    });
  });

  test("should configure console integration with correct error levels", () => {
    // WHEN initSentry is called
    initSentry();

    // THEN expect captureConsoleIntegration to be called with correct levels
    expect(Sentry.captureConsoleIntegration).toHaveBeenCalledWith({
      levels: ["error"],
    });
  });
});
