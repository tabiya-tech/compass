import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";

import { waitFor } from "src/_test_utilities/test-utils";
import MetricsService, { METRICS_FLUSH_INTERVAL_MS } from "src/metrics/metricsService";
import { CVDownloadedEvent, EventType, MetricsEventUnion } from "src/metrics/types";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { CVFormat } from "src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown";
import { StatusCodes } from "http-status-codes";
import * as CustomFetchModule from "src/utils/customFetch/customFetch";

describe("MetricsService", () => {
  let givenApiServerUrl: string = "/path/to/api";

  beforeEach(() => {
    // GIVEN a mocked API server URL
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);

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
          body: JSON.stringify([givenEvent1, givenEvent2]),
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
          coordinates: [123.456, 78.910],
          timestamp: new Date().toISOString(),
        },
        {
          event_type: EventType.DEVICE_SPECIFICATION,
          user_id: "user123",
          device_type: "desktop",
          os_type: "Windows",
          browser_type: "Chrome",
          browser_version: "1.0.0",
          user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
          relevant_experiments: { "exp1": "group1", "exp2": "group2" }
        },
      ];

      // AND a successful response from the API
      const fetchSpy = setupAPIServiceSpy(StatusCodes.ACCEPTED, undefined, "");

      // WHEN sending the events
      const service = MetricsService.getInstance();
      givenEvents.forEach(event => service.sendMetricsEvent(event));

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
          body: JSON.stringify(givenEvents),
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

      // AND an unsuccessful response from the API
      const errorResponse = { message: "Something went wrong" };
      const fetchSpy = setupAPIServiceSpy(StatusCodes.BAD_REQUEST, errorResponse, "application/json;charset=UTF-8");

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
        body: JSON.stringify([newEvent]),
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
      jest.spyOn(require("src/envService"), "getMetricsEnabled").mockReturnValueOnce("false");
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
  });
});
