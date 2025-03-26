import "src/_test_utilities/consoleMock";
import { waitFor } from "src/_test_utilities/test-utils";
import MetricsService, { METRICS_FLUSH_INTERVAL_MS } from "src/metrics/metricsService";
import { CVDownloadedEvent, EventType } from "src/metrics/types";
import { setupFetchSpy } from "src/_test_utilities/fetchSpy";
import { CVFormat } from "src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown";
import * as metricsUtilsModule from "src/metrics/utils/encryption"
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
      };

      const givenEvent2: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.DOCX,
        session_id: 124,
        user_id: "456",
      };

      // AND a successful response from the API
      const customFetchSpy = jest.spyOn(CustomFetchModule, "customFetch").mockResolvedValue(new Response());

      // AND decrypt events will return some payload
      const givenEncryptedPayload = "givenEncryptedPayload"
      jest.spyOn(metricsUtilsModule, "encryptEventsPayload").mockReturnValue(givenEncryptedPayload)

      // WHEN sending multiple metrics events
      const service = MetricsService.getInstance();
      await service.sendMetricsEvent(givenEvent1);
      await service.sendMetricsEvent(givenEvent2);

      // THEN expect no immediate API calls
      expect(customFetchSpy).not.toHaveBeenCalled();

      // WHEN the flush interval passes
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect it to make a POST request with all events.
      await waitFor(() => {
        expect(customFetchSpy).toHaveBeenCalledWith(
          `${givenApiServerUrl}/metrics`,
          {
            method: "POST",
            expectedStatusCode: 202,
            serviceFunction: "flushEvents",
            serviceName: "MetricsService",
            failureMessage: "Failed to send metrics events",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              payload: givenEncryptedPayload
            })
          }
        );
      })
    });

    test("should log error but continue when API call fails", async () => {
      // GIVEN a metrics event
      const givenEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.PDF,
        session_id: 123,
        user_id: "456",
      };

      // AND fetch will fail
      const givenError = new Error("given error");
      jest.spyOn(CustomFetchModule, "customFetch").mockRejectedValue(givenError);

      // AND decrypt events will return some payload
      const givenEncryptedPayload = "givenEncryptedPayload"
      jest.spyOn(metricsUtilsModule, "encryptEventsPayload").mockReturnValue(givenEncryptedPayload)

      // WHEN sending a metrics event
      const service = MetricsService.getInstance();
      await service.sendMetricsEvent(givenEvent);

      // AND the flush interval passes
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect the error to be logged but not thrown
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith("Error sending metrics events:", givenError);
      })
    });

    test("should log error but not throw when response is not accepted", async () => {
      // GIVEN a metrics event
      const givenEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.PDF,
        session_id: 123,
        user_id: "456",
      };

      // AND an unsuccessful response from the API
      const errorResponse = { message: "Something went wrong" };
      const customFetchSpy = jest.spyOn(CustomFetchModule, "customFetch").mockRejectedValue(errorResponse);

      // AND decrypt events will return some payload
      const givenEncryptedPayload = "givenEncryptedPayload";
      jest.spyOn(metricsUtilsModule, "encryptEventsPayload").mockReturnValue(givenEncryptedPayload);

      // WHEN sending a metrics event
      const service = MetricsService.getInstance();
      await service.sendMetricsEvent(givenEvent);

      // AND the flush interval passes
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect the error to be logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith("Error sending metrics events:", errorResponse);
      });

      // AND GIVEN another event
      const newEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.DOCX,
        session_id: 124,
        user_id: "456",
      };

      // WHEN sending the new event
      await service.sendMetricsEvent(newEvent);

      // AND the flush interval passes
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect only the new event to be sent
      expect(customFetchSpy).toHaveBeenLastCalledWith(`${givenApiServerUrl}/metrics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        serviceFunction: "flushEvents",
        serviceName: "MetricsService",
        expectedStatusCode: 202,
        failureMessage: "Failed to send metrics events",
        body: JSON.stringify({
          payload: givenEncryptedPayload,
        }),
      });
    });

    test("should not make API calls when buffer is empty", async () => {
      // GIVEN a spy on fetch
      const fetchSpy = setupFetchSpy(202, undefined, "");

      // WHEN the flush interval passes without any events
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect no API calls
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
}); 