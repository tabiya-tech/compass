import "src/_test_utilities/consoleMock";

import * as Sentry from "@sentry/react";
import { initSentry, SENTRY_CONFIG_DEFAULT, SentryConfig } from "./sentryInit";
import { getBackendUrl, getSentryDSN, getSentryEnabled, getSentryConfig } from "./envService";
import * as EnvServiceModule from "./envService";
import InfoService from "./info/info.service";
import { VersionItem } from "./info/info.types";
import { getRandomString } from "./_test_utilities/specialCharacters";

// Mock all the required dependencies
jest.mock("@sentry/react", () => ({
  init: jest.fn(),
  browserTracingIntegration: jest.fn(),
  replayIntegration: jest.fn(),
  feedbackIntegration: jest.fn(),
  captureConsoleIntegration: jest.fn(),
  reactRouterV6BrowserTracingIntegration: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
}));

jest.mock("./envService", () => ({
  getBackendUrl: jest.fn(),
  getTargetEnvironmentName: jest.fn(),
  getSentryDSN: jest.fn(),
  getSentryEnabled: jest.fn(),
  getSentryConfig: jest.fn(),
}));

function getRandomVersion(): VersionItem {
  return {
    date: getRandomString(10),
    branch: getRandomString(10),
    sha: getRandomString(40),
    buildNumber: getRandomString(10),
  };
}

describe("sentryInit", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock returns
    (getSentryDSN as jest.Mock).mockReturnValue("mock-dsn");
    (getBackendUrl as jest.Mock).mockReturnValue("https://api.example.com");
    (getSentryEnabled as jest.Mock).mockReturnValue("true");
    (getSentryConfig as jest.Mock).mockReturnValue("");
  });
  describe("Enable sentry", () => {
    test("should initialize Sentry if sentry is enabled and DSN is available", () => {
      // GIVEN sentry is enabled and DSN is available
      (getSentryEnabled as jest.Mock).mockReturnValue("tRuE");
      (getSentryDSN as jest.Mock).mockReturnValue("mock-dsn");

      // WHEN initSentry is called
      initSentry();

      // THEN expect Sentry.init to be called
      expect(Sentry.init).toHaveBeenCalled();
    });

    test("should not initialize Sentry if DSN is not available", () => {
      // GIVEN sentry is enabled
      (getSentryEnabled as jest.Mock).mockReturnValue("true");
      // AND the DSN is not available
      (getSentryDSN as jest.Mock).mockReturnValue("");

      // WHEN initSentry is called
      initSentry();

      // THEN expect Sentry.init not to be called
      expect(Sentry.init).not.toHaveBeenCalled();

      // AND log a warning message
      expect(console.warn).toHaveBeenCalledWith(
        "Sentry is enabled but DSN is not available. Sentry will not be initialized."
      );
    });

    test("should not initialize Sentry if sentry is disabled", () => {
      // GIVEN sentry is disabled
      (getSentryEnabled as jest.Mock).mockReturnValue("false");
      // AND the DSN is available
      (getSentryDSN as jest.Mock).mockReturnValue("mock-dsn");

      // WHEN initSentry is called
      initSentry();

      // THEN expect Sentry.init not to be called

      expect(Sentry.init).not.toHaveBeenCalled();

      // AND log an info message
      expect(console.info).toHaveBeenCalledWith("Sentry is not enabled. Sentry will not be initialized.");
    });

    test("should set the context/Frontend version on init", async () => {
      // GIVEN infoService.loadInfo has both frontend/backend version.
      const givenFrontendVersion = getRandomVersion();
      const givenBackendVersion = getRandomVersion();
      jest
        .spyOn(InfoService.prototype, "loadInfo")
        .mockResolvedValue({ frontend: givenFrontendVersion, backend: givenBackendVersion });

      // WHEN sentry is initialized.
      initSentry();

      // AND all promises are resolved
      await Promise.resolve();

      // THEN sentry_sdk.set_context should be called with the frontend version.
      expect(Sentry.setContext).toHaveBeenCalledWith("Frontend Version", givenFrontendVersion);
    });
  });

  describe("Sentry config", () => {
    // Set up mocks
    const mockBrowserTracing = { name: "browserTracing" };
    const mockFeedback = { name: "feedback" };
    const mockConsole = { name: "console" };
    const mockRouter = { name: "router" };
    const mockReplay = { name: "replay" };
    (Sentry.browserTracingIntegration as jest.Mock).mockReturnValue(mockBrowserTracing);
    (Sentry.replayIntegration as jest.Mock).mockReturnValue(mockReplay);
    (Sentry.feedbackIntegration as jest.Mock).mockReturnValue(mockFeedback);
    (Sentry.captureConsoleIntegration as jest.Mock).mockReturnValue(mockConsole);
    (Sentry.reactRouterV6BrowserTracingIntegration as jest.Mock).mockReturnValue(mockRouter);

    function assertSentryInitCalledWithCorrectConfig(expectedConfig: SentryConfig) {
      const expectedIntegrations = [mockBrowserTracing, mockFeedback, mockConsole, mockRouter];
      if (expectedConfig.replayIntegration) {
        expectedIntegrations.push(mockReplay);
      }
      expect(Sentry.init).toHaveBeenCalledWith({
        dsn: "mock-dsn",
        environment: "given-target-environment-name",
        integrations: expectedIntegrations,
        tracesSampleRate: expectedConfig.tracesSampleRate,
        tracePropagationTargets: ["localhost", "https://api.example.com"],
        replaysSessionSampleRate: expectedConfig.replaysSessionSampleRate,
        replaysOnErrorSampleRate: expectedConfig.replaysOnErrorSampleRate,
        beforeSend: expect.any(Function),
      });

      // AND the Sentry.captureConsoleIntegration  should be called with default levels
      expect(Sentry.captureConsoleIntegration).toHaveBeenCalledWith({
        levels: expectedConfig.levels,
      });
      // and the Sentry.feedbackIntegration should be called with default options
      expect(Sentry.feedbackIntegration).toHaveBeenCalledWith({
        showBranding: false,
        autoInject: false,
        colorScheme: "light",
        enableScreenshot: true,
      });

      // AND the Sentry.replayIntegration should
      if (expectedConfig.replayIntegration) {
        expect(Sentry.replayIntegration).toHaveBeenCalled();
      } else {
        expect(Sentry.replayIntegration).not.toHaveBeenCalled();
      }
    }

    // Should use default config if json is not available and log a warning
    test("should use default config if json is not available", () => {
      // GIVEN the necessary configuration values are available
      const givenTargetEnvironmentName = "given-target-environment-name";
      (EnvServiceModule.getTargetEnvironmentName as jest.Mock).mockReturnValue(givenTargetEnvironmentName);

      // GIVEN the json config is not available
      (getSentryConfig as jest.Mock).mockReturnValue("");
      // WHEN initSentry is called
      initSentry();
      // THEN expect Sentry.init to be called with default config
      assertSentryInitCalledWithCorrectConfig(SENTRY_CONFIG_DEFAULT);

      // AND a warning should be logged after the init
      // to indicate that the default config is being used
      expect(console.warn).toHaveBeenCalledAfter(Sentry.init as jest.Mock);
      expect(console.warn).toHaveBeenCalledWith(
        "Warning loading Sentry: Sentry config is not available, reverting to default config"
      );
      // AND no error should be logged
      expect(console.error).not.toHaveBeenCalled();
    });

    // Should use default config if json is not available and log a warning
    test("should use default config if json could not be parsed", () => {
      // GIVEN the necessary configuration values are available
      const givenTargetEnvironmentName = "given-target-environment-name";
      (EnvServiceModule.getTargetEnvironmentName as jest.Mock).mockReturnValue(givenTargetEnvironmentName);

      // GIVEN the json config is not available
      (getSentryConfig as jest.Mock).mockReturnValue("}{");
      // WHEN initSentry is called
      initSentry();
      // THEN expect Sentry.init to be called with default config
      assertSentryInitCalledWithCorrectConfig(SENTRY_CONFIG_DEFAULT as any);

      // AND an error should be logged after the init
      // to indicate that the default config is being used
      expect(console.error).toHaveBeenCalledAfter(Sentry.init as jest.Mock);
      expect(console.error).toHaveBeenCalledWith(
        "Error loading Sentry: Error parsing Sentry config JSON, reverting to default config",
        expect.any(Error)
      );
      // AND no warning should be logged
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      [
        "All set",
        JSON.stringify({
          tracesSampleRate: 0.1,
          replaysSessionSampleRate: 0.2,
          replaysOnErrorSampleRate: 0.3,
          replayIntegration: true,
          levels: ["error", "warn", "info", "debug"],
        }),
        {
          tracesSampleRate: 0.1,
          replaysSessionSampleRate: 0.2,
          replaysOnErrorSampleRate: 0.3,
          replayIntegration: true,
          levels: ["error", "warn", "info", "debug"],
        },
      ],
      [
        "Only Replay Integration (true)",
        JSON.stringify({ replayIntegration: true }),
        { ...SENTRY_CONFIG_DEFAULT, replayIntegration: true },
      ],
      [
        "Only Replay Integration (false)",
        JSON.stringify({ replayIntegration: false }),
        { ...SENTRY_CONFIG_DEFAULT, replayIntegration: false },
      ],
      [
        "Only Traces Sample Rate",
        JSON.stringify({ tracesSampleRate: 0.5 }),
        { ...SENTRY_CONFIG_DEFAULT, tracesSampleRate: 0.5 },
      ],
      [
        "Only Replays Session Sample Rate",
        JSON.stringify({ replaysSessionSampleRate: 0.6 }),
        { ...SENTRY_CONFIG_DEFAULT, replaysSessionSampleRate: 0.6 },
      ],
      [
        "Only Replays On Error Sample Rate",
        JSON.stringify({ replaysOnErrorSampleRate: 0.7 }),
        { ...SENTRY_CONFIG_DEFAULT, replaysOnErrorSampleRate: 0.7 },
      ],
      ["Only Levels", JSON.stringify({ levels: ["error"] }), { ...SENTRY_CONFIG_DEFAULT, levels: ["error"] }],
    ])("should use given config %s", (_, givenJsonConfig: string, expectedConfig: SentryConfig) => {
      // GIVEN the necessary configuration values are available
      const givenTargetEnvironmentName = "given-target-environment-name";
      (EnvServiceModule.getTargetEnvironmentName as jest.Mock).mockReturnValue(givenTargetEnvironmentName);

      // GIVEN the json config is available
      (getSentryConfig as jest.Mock).mockReturnValue(givenJsonConfig);
      // WHEN initSentry is called
      initSentry();
      // THEN expect Sentry.init to be called with default config
      assertSentryInitCalledWithCorrectConfig(expectedConfig);

      // AND no error should be logged
      expect(console.error).not.toHaveBeenCalled();
      // AND no warning should be logged
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
