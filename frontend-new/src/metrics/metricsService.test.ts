import "src/_test_utilities/consoleMock";
import { waitFor } from "src/_test_utilities/test-utils";
import MetricsService, { METRICS_FLUSH_INTERVAL_MS } from "src/metrics/metricsService";
import { CVDownloadedEvent, EventType } from "src/metrics/types";
import { setupFetchSpy } from "src/_test_utilities/fetchSpy";
import { CVFormat } from "src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown";


describe("MetricsService", () => {
  let givenApiServerUrl: string = "/path/to/api";

  beforeEach(() => {
    // GIVEN a mocked API server URL
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should return a new instance of MetricsService", () => {
    // WHEN calling getInstance
    const instance = MetricsService.getInstance();

    // THEN expect it to return a new instance of MetricsService
    expect(instance).toBeInstanceOf(MetricsService);
  });

  describe("sendMetricsEvent", () => {
    test("should fetch the correct URL with POST and the correct headers and payload successfully", async () => {
      // GIVEN a metrics event
      const givenEvent: CVDownloadedEvent = {
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
      const fetchSpy = setupFetchSpy(202, undefined, ""); // Backend returns 202 ACCEPTED

      // WHEN sending a metrics event
      const service = MetricsService.getInstance();
      await service.sendMetricsEvent(givenEvent);

      // THEN expect it to make a POST request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/metrics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(givenEvent),
        }
      );
    });

    test("should log error but not throw when fetch fails", async () => {
      // GIVEN a metrics event
      const givenEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.PDF,
        session_id: 123,
        user_id: "456",
      };

      // AND fetch will fail
      const givenError = new Error("Network error");
      jest.spyOn(window, "fetch").mockRejectedValueOnce(givenError);

      // WHEN sending a metrics event
      const service = MetricsService.getInstance();
      await service.sendMetricsEvent(givenEvent);

      // THEN expect the error to be logged but not thrown
      expect(console.error).toHaveBeenCalledWith("Error sending metrics event:", givenError);
    });

    test("should log error but not throw when response is not accpted", async () => {
      // GIVEN a metrics event
      const givenEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.PDF,
        session_id: 123,
        user_id: "456",
      };

      // AND an unsuccessful response from the API
      const errorResponse = { message: "Something went wrong" };
      const fetchSpy = setupFetchSpy(400, errorResponse, "application/json;charset=UTF-8");


      // WHEN sending a metrics event
      const service = MetricsService.getInstance();
      await service.sendMetricsEvent(givenEvent);

      // AND the flush interval passes
      jest.advanceTimersByTime(METRICS_FLUSH_INTERVAL_MS);
      // Let any pending promises resolve
      await Promise.resolve();

      // THEN expect the error to be logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          "Failed to send metrics events:",
          JSON.stringify(errorResponse)
        );
      })

      // AND GIVEN another event
      const newEvent: CVDownloadedEvent = {
        event_type: EventType.CV_DOWNLOADED,
        cv_format: CVFormat.DOCX,
        session_id: 124,
        user_id: "456",
      };

      // AND a successful response for the next call
      fetchSpy.mockImplementationOnce(() =>
        Promise.resolve(new Response(undefined, { status: 202 }))
      );
    });
  });
}); 