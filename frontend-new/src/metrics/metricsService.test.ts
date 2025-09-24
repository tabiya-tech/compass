import "src/_test_utilities/consoleMock";

import { waitFor } from "src/_test_utilities/test-utils";
import MetricsService, { METRICS_FLUSH_INTERVAL_MS, loadFrontendMetricsConfig } from "src/metrics/metricsService";
import { CVDownloadedEvent, EventType, MetricsEventUnion, SavableMetricsEventUnion } from "src/metrics/types";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { CVFormat } from "src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown";
import { StatusCodes } from "http-status-codes";
import * as CustomFetchModule from "src/utils/customFetch/customFetch";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import * as MetricsModule from "src/metrics/metricsService";
import * as EnvServiceModule from "src/envService";

jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
  getMetricsEnabled: jest.fn(() => "true"),
  getMetricsConfig: jest.fn(() => ""),
}));

const addClientId = (event: MetricsEventUnion, clientId: string): SavableMetricsEventUnion => {
  return {
    ...event,
    client_id: clientId,
  };
};

describe("MetricsService", () => {
  let givenApiServerUrl: string = "/path/to/api";

  beforeEach(() => {
    // GIVEN a mocked API server URL
    jest.spyOn(EnvServiceModule, "getBackendUrl").mockReturnValue(givenApiServerUrl);

    // Reset timers and mocks
    jest.useFakeTimers();
    jest.clearAllMocks();
    // reset the metric service instance to ensure tests get a clean timer interval state
    // Clean up the service
    MetricsService.getInstance().dispose();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("should return a new instance of MetricsService", () => {
    // WHEN calling getInstance
    const instance = MetricsService.getInstance();

    // THEN expect it to return a new instance of MetricsService
    expect(instance).toBeInstanceOf(MetricsService);
  });

  describe("sendMetricsEvent", () => {
    test("should buffer events and send them after the flush interval", async () => {
      // GIVEN some metrics events
      const givenEvent1: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.PDF,
        session_id: 123,
        user_id: "456",
        timestamp: new Date().toISOString(),
      };

      const givenEvent2: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.DOCX,
        session_id: 124,
        user_id: "456",
        timestamp: new Date().toISOString(),
      };

      // AND given a client id
      const givenClientId = "test-client-id";
      jest.spyOn(PersistentStorageService, "getClientId").mockReturnValue(givenClientId);

      // AND a successful response from the API
      const fetchSpy = setupAPIServiceSpy(StatusCodes.ACCEPTED, undefined, ""); // Backend returns 202 ACCEPTED

      // WHEN sending multiple metrics events
      const service = MetricsService.getInstance();
      service.sendMetricsEvent(givenEvent1);
      service.sendMetricsEvent(givenEvent2);

      // THEN expect no immediate API calls
      expect(fetchSpy).not.toHaveBeenCalled();

      // WHEN the flush interval passes
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect it to make a POST request with all events
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(`${givenApiServerUrl}/metrics`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          serviceName: "MetricsService",
          serviceFunction: "flushEvents",
          failureMessage: "Failed to send metrics events",
          expectedStatusCode: StatusCodes.ACCEPTED,
          body: JSON.stringify([addClientId(givenEvent1, givenClientId), addClientId(givenEvent2, givenClientId)]),
        });
      });
    });

    test("should handle different event types correctly", async () => {
      const givenEvents: MetricsEventUnion[] = [
        {
          event_type: EventType.CV_DOWNLOADED,
          cv_format: CVFormat.PDF,
          session_id: 123,
          user_id: "456",
          timestamp: new Date().toISOString(),
        },
        {
          event_type: EventType.USER_LOCATION,
          user_id: "456",
          coordinates: [123.456, 78.91],
          timestamp: new Date().toISOString(),
        },
        {
          event_type: EventType.DEVICE_SPECIFICATION,
          user_id: "user123",
          device_type: "desktop",
          os_type: "Windows",
          browser_type: "Chrome",
          browser_version: "1.0.0",
          user_agent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          timestamp: new Date().toISOString(),
        },
        {
          event_type: EventType.NETWORK_INFORMATION,
          user_id: "456",
          effective_connection_type: "4G",
          connection_type: 5,
        },
        {
          event_type: EventType.UI_INTERACTION,
          user_id: "user123",
          actions: ["foo", "bar"],
          element_id: "foo_element",
          timestamp: new Date().toISOString(),
          relevant_experiments: { exp1: "group1", exp2: "group2" },
          details: { foo1: "bar1", foo2: "bar2" },
        },
      ];

      // AND a successful response from the API
      const fetchSpy = setupAPIServiceSpy(StatusCodes.ACCEPTED, undefined, "");

      // AND given a client id
      const givenClientId = "test-client-id";
      jest.spyOn(PersistentStorageService, "getClientId").mockReturnValue(givenClientId);

      // WHEN sending the events
      const service = MetricsService.getInstance();
      givenEvents.forEach((event) => service.sendMetricsEvent(event));

      // AND the flush interval passes
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect it to make a POST request with the events
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(`${givenApiServerUrl}/metrics`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          serviceName: "MetricsService",
          serviceFunction: "flushEvents",
          failureMessage: "Failed to send metrics events",
          expectedStatusCode: StatusCodes.ACCEPTED,
          body: JSON.stringify(givenEvents.map((event) => addClientId(event, givenClientId))),
        });
      });
    });

    test("should log error but continue when API call fails", async () => {
      // GIVEN a metrics event
      const givenEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.PDF,
        session_id: 123,
        user_id: "456",
        timestamp: new Date().toISOString(),
      };

      // AND fetch will fail
      const givenError = new Error("Network error");
      jest.spyOn(CustomFetchModule, "customFetch").mockRejectedValueOnce(givenError);

      // WHEN sending a metrics event
      const service = MetricsService.getInstance();
      service.sendMetricsEvent(givenEvent);

      // AND the flush interval passes
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect the error to be logged but not thrown
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledOnce();
      });
    });

    test("should log error but not throw when response is not accpted", async () => {
      // GIVEN a metrics event
      const givenEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.PDF,
        session_id: 123,
        user_id: "456",
        timestamp: new Date().toISOString(),
      };

      // AND given a client id
      const givenClientId = "test-client-id";
      jest.spyOn(PersistentStorageService, "getClientId").mockReturnValue(givenClientId);

      // AND an unsuccessful response from the API
      const errorResponse = new Error("Something went wrong");
      const fetchSpy = setupAPIServiceSpy(StatusCodes.BAD_REQUEST, errorResponse, "application/json;charset=UTF-8");
      fetchSpy.mockRejectedValueOnce(errorResponse);

      // WHEN sending a metrics event
      const service = MetricsService.getInstance();
      service.sendMetricsEvent(givenEvent);

      // AND the flush interval passes
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect the error to be logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledOnce();
      });

      // AND GIVEN another event
      const newEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.DOCX,
        session_id: 124,
        user_id: "456",
        timestamp: new Date().toISOString(),
      };

      // AND a successful response for the next call
      fetchSpy.mockImplementationOnce(() => Promise.resolve(new Response(undefined, { status: 202 })));

      // WHEN sending the new event
      service.sendMetricsEvent(newEvent);

      // AND the flush interval passes
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect only the new event to be sent
      expect(fetchSpy).toHaveBeenLastCalledWith(`${givenApiServerUrl}/metrics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        serviceName: "MetricsService",
        serviceFunction: "flushEvents",
        failureMessage: "Failed to send metrics events",
        expectedStatusCode: StatusCodes.ACCEPTED,
        body: JSON.stringify([addClientId(newEvent, givenClientId)]),
      });
    });

    test("should not make API calls when buffer is empty", async () => {
      // GIVEN a spy on fetch
      const fetchSpy = setupAPIServiceSpy(StatusCodes.ACCEPTED, undefined, "");

      // WHEN the flush interval passes without any events
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect no API calls
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test("should not add events if metrics are disabled and log a warning", () => {
      // GIVEN the metrics are disabled
      jest.spyOn(EnvServiceModule, "getMetricsEnabled").mockReturnValueOnce("false");
      // AND a metrics event
      const givenEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.PDF,
        session_id: 123,
        user_id: "456",
        timestamp: new Date().toISOString(),
      };

      // WHEN sending a metrics event
      const service = MetricsService.getInstance();
      service.sendMetricsEvent(givenEvent);

      // THEN expect the event not to be added to the buffer
      expect(service["_eventBuffer"]).toHaveLength(0);
      // AND the warning to be logged
      expect(console.warn).toHaveBeenCalledWith("Metrics are disabled. No metrics will be sent.");
    });

    test("should not record metrics for disabled event types and log a debug message", () => {
      // GIVEN a metrics event
      const givenEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.PDF,
        session_id: 123,
        user_id: "456",
        timestamp: new Date().toISOString(),
      };

      // AND the metrics config has the CV_DOWNLOADED event disabled
      MetricsModule.cfg.events.CV_DOWNLOADED.enabled = false;

      // AND a spy on console.debug
      const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});

      // WHEN sending the metrics event
      const service = MetricsService.getInstance();
      service.sendMetricsEvent(givenEvent);

      // THEN the event should not be added to the internal buffer
      expect(service["_eventBuffer"]).toHaveLength(0);

      // AND a debug message should be logged
      expect(debugSpy).toHaveBeenCalledWith("Metric event CV_DOWNLOADED is disabled. No metrics will be sent");
    });
  });

  describe("loadFrontendMetricsConfig", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("should return defaults when no config is provided", () => {
      // GIVEN envService returns an empty string
      jest.spyOn(EnvServiceModule, "getMetricsConfig").mockReturnValueOnce("");
      const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});

      // WHEN loading the config
      const cfg = loadFrontendMetricsConfig();

      // THEN defaults are applied
      expect(cfg.flushIntervalMs).toBe(15000);
      // AND all events are enabled
      expect(Object.values(cfg.events).every((e) => e.enabled)).toBe(true);
      // AND a debug message is logged
      expect(debugSpy).toHaveBeenCalledWith("Metrics config is not available, using the default config");
    });

    test("should apply provided flushIntervalMs and event flags", () => {
      // GIVEN a config that sets flushIntervalMs and disables CV_DOWNLOADED
      const parsed = { flushIntervalMs: 30000, events: { CV_DOWNLOADED: { enabled: false } } };
      const raw = JSON.stringify(parsed);
      jest.spyOn(EnvServiceModule, "getMetricsConfig").mockReturnValueOnce(raw);

      // WHEN loading the config
      const cfg = loadFrontendMetricsConfig();

      // THEN flushIntervalMs is updated
      expect(cfg.flushIntervalMs).toBe(30000);
      // AND CV_DOWNLOADED is disabled
      expect(cfg.events.CV_DOWNLOADED.enabled).toBe(false);
      // AND at least one other event remains enabled
      expect(Object.values(cfg.events).some((e) => e.enabled)).toBe(true);
    });

    test("should ignore unknown event keys and log a debug message", () => {
      // GIVEN a config with an unknown event
      const parsed = {
        events: { UNKNOWN_EVENT: { enabled: false }, CV_DOWNLOADED: { enabled: true } },
      };
      const raw = JSON.stringify(parsed);
      jest.spyOn(EnvServiceModule, "getMetricsConfig").mockReturnValueOnce(raw);
      const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});

      // WHEN loading the config
      const cfg = loadFrontendMetricsConfig();

      // THEN known events are preserved
      expect(cfg.events.CV_DOWNLOADED.enabled).toBe(true);
      // AND unknown keys are ignored with a debug log
      expect(debugSpy).toHaveBeenCalledWith("Ignoring unknown event key in metrics config: UNKNOWN_EVENT");
    });

    test("should return defaults and log a warning on malformed JSON", () => {
      // GIVEN a malformed JSON string
      jest.spyOn(EnvServiceModule, "getMetricsConfig").mockReturnValueOnce("}{");
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      // WHEN loading the config
      const cfg = loadFrontendMetricsConfig();

      // THEN defaults are used
      expect(cfg.flushIntervalMs).toBe(15000);
      // AND all events are enabled
      expect(Object.values(cfg.events).every((e) => e.enabled)).toBe(true);
      // AND a warning is logged
      expect(warnSpy).toHaveBeenCalledWith(
        "Failed to parse FRONTEND_METRICS_CONFIG, using defaults",
        expect.any(Error)
      );
    });
  });
});
