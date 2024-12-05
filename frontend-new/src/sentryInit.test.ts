import * as Sentry from "@sentry/react";
import { initSentry } from "./sentryInit";
import { getBackendUrl, getSentryDSN } from "./envService";
import anonymizeIP from "ip-anonymize";

// Mock all the required dependencies
jest.mock("@sentry/react", () => ({
  init: jest.fn(),
  browserTracingIntegration: jest.fn(),
  replayIntegration: jest.fn(),
  feedbackIntegration: jest.fn(),
  captureConsoleIntegration: jest.fn(),
  reactRouterV6BrowserTracingIntegration: jest.fn(),
}));

jest.mock("./envService", () => ({
  getBackendUrl: jest.fn(),
  getSentryDSN: jest.fn(),
}));

jest.mock("ip-anonymize", () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe("sentryInit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    (getSentryDSN as jest.Mock).mockReturnValue("mock-dsn");
    (getBackendUrl as jest.Mock).mockReturnValue("https://api.example.com");
    (anonymizeIP as jest.Mock).mockImplementation((ip) => `anonymized-${ip}`);
  });

  test("should initialize Sentry with correct configuration", () => {
    // GIVEN the necessary configuration values are available
    const mockBrowserTracing = { name: "browserTracing" };
    const mockReplay = { name: "replay" };
    const mockFeedback = { name: "feedback" };
    const mockConsole = { name: "console" };
    const mockRouter = { name: "router" };

    (Sentry.browserTracingIntegration as jest.Mock).mockReturnValue(mockBrowserTracing);
    (Sentry.replayIntegration as jest.Mock).mockReturnValue(mockReplay);
    (Sentry.feedbackIntegration as jest.Mock).mockReturnValue(mockFeedback);
    (Sentry.captureConsoleIntegration as jest.Mock).mockReturnValue(mockConsole);
    (Sentry.reactRouterV6BrowserTracingIntegration as jest.Mock).mockReturnValue(mockRouter);

    // WHEN initSentry is called
    initSentry();

    // THEN expect Sentry.init to be called with the correct configuration
    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: "mock-dsn",
      integrations: [
        mockBrowserTracing,
        mockReplay,
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
      replaysOnErrorSampleRate: 1.0,
      beforeSend: expect.any(Function),
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

  describe("beforeSend handler", () => {
    test("should anonymize IP address when present", () => {
      // GIVEN an event with an IP address
      const mockEvent = {
        user: {
          ip_address: "192.168.1.1",
          id: "user123",
        },
      };

      // WHEN initSentry is called
      initSentry();

      // THEN extract the beforeSend function and test it
      const beforeSendFn = (Sentry.init as jest.Mock).mock.calls[0][0].beforeSend;
      const modifiedEvent = beforeSendFn(mockEvent);

      // AND expect the IP to be anonymized
      expect(anonymizeIP).toHaveBeenCalledWith("192.168.1.1");
      expect(modifiedEvent.user.ip_address).toBe("anonymized-192.168.1.1");
    });

    test("should handle events without IP address", () => {
      // GIVEN an event without an IP address
      const mockEvent = {
        user: {
          id: "user123",
        },
      };

      // WHEN initSentry is called
      initSentry();

      // THEN extract the beforeSend function and test it
      const beforeSendFn = (Sentry.init as jest.Mock).mock.calls[0][0].beforeSend;
      const modifiedEvent = beforeSendFn(mockEvent);

      // AND expect the event to be unchanged
      expect(anonymizeIP).not.toHaveBeenCalled();
      expect(modifiedEvent).toEqual(mockEvent);
    });

    test("should handle events without user object", () => {
      // GIVEN an event without a user object
      const mockEvent = {
        message: "test error",
      };

      // WHEN initSentry is called
      initSentry();

      // THEN extract the beforeSend function and test it
      const beforeSendFn = (Sentry.init as jest.Mock).mock.calls[0][0].beforeSend;
      const modifiedEvent = beforeSendFn(mockEvent);

      // AND expect the event to be unchanged
      expect(anonymizeIP).not.toHaveBeenCalled();
      expect(modifiedEvent).toEqual(mockEvent);
    });

    test("should handle null IP anonymization result", () => {
      // GIVEN an event with an IP address and anonymizeIP returns null
      const mockEvent = {
        user: {
          ip_address: "192.168.1.1",
          id: "user123",
        },
      };
      (anonymizeIP as jest.Mock).mockReturnValue(null);

      // WHEN initSentry is called
      initSentry();

      // THEN extract the beforeSend function and test it
      const beforeSendFn = (Sentry.init as jest.Mock).mock.calls[0][0].beforeSend;
      const modifiedEvent = beforeSendFn(mockEvent);

      // AND expect the IP to be set to undefined
      expect(anonymizeIP).toHaveBeenCalledWith("192.168.1.1");
      expect(modifiedEvent.user.ip_address).toBeUndefined();
    });
  });
});