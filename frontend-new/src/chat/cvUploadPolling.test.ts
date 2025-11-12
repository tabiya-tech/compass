import { startUploadPolling, stopUploadPolling, getCvUploadDisplayMessage } from "./cvUploadPolling";
import i18n from "src/i18n/i18n";

// Use real timers for these tests since the async nature of setInterval is complex with fake timers

describe("cvUploadPolling", () => {
  test("getCvUploadDisplayMessage maps states", () => {
    expect(getCvUploadDisplayMessage({ upload_process_state: "CONVERTING" })).toBe(i18n.t("chat.cvUploadPolling.converting"));
    expect(getCvUploadDisplayMessage({ upload_process_state: "UPLOADING_TO_GCS" })).toBe(i18n.t("chat.cvUploadPolling.processing"));
    expect(getCvUploadDisplayMessage({ upload_process_state: "EXTRACTING" })).toBe(i18n.t("chat.cvUploadPolling.extractingExperiences"));
    expect(getCvUploadDisplayMessage({ upload_process_state: "SAVING" })).toBe(i18n.t("chat.cvUploadPolling.savingCv"));
    expect(getCvUploadDisplayMessage({ upload_process_state: "FAILED" })).toBe(i18n.t("chat.cvUploadPolling.failed"));
    expect(getCvUploadDisplayMessage({ upload_process_state: "COMPLETED" })).toBe(i18n.t("chat.cvUploadPolling.uploadedSuccessfully"));
    expect(getCvUploadDisplayMessage({ upload_process_state: "CANCELLED" })).toBe(i18n.t("chat.cvUploadPolling.cancelled"));
    expect(getCvUploadDisplayMessage({ upload_process_state: "PENDING_UPLOAD" })).toBe(i18n.t("chat.cvUploadPolling.uploadingCv"));
  });

  test("polling calls onStatus and completes", async () => {
    // GIVEN a status sequence that completes
    const recordedEvents: string[] = [];
    const getStatusMock = jest
      .fn()
      .mockResolvedValueOnce({ upload_process_state: "CONVERTING" })
      .mockResolvedValueOnce({ upload_process_state: "EXTRACTING" })
      .mockResolvedValueOnce({ upload_process_state: "COMPLETED" });

    // WHEN starting polling with very short intervals for testing
    const handles = startUploadPolling({
      uploadId: "id",
      pollIntervalMs: 10, // Very short for testing
      maxDurationMs: 60_000,
      getStatus: getStatusMock,
      onStatus: (status) => {
        if (!status) return;
        recordedEvents.push(`status:${status.upload_process_state}`);
      },
      onComplete: (status) => recordedEvents.push(`complete:${status.upload_process_state}`),
      onTerminal: (status) => recordedEvents.push(`terminal:${status.upload_process_state}`),
      onError: (error) => recordedEvents.push(`error:${error}`),
    });

    // Wait for all three polls to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // stop timers and cleanup
    stopUploadPolling(handles);

    // THEN expect the events to reflect the status changes and completion
    expect(recordedEvents).toEqual([
      "status:CONVERTING",
      "status:EXTRACTING",
      "status:COMPLETED",
      "complete:COMPLETED",
    ]);
  });

  test("polling terminates on FAILED", async () => {
    // GIVEN a status sequence that fails
    const recordedEvents: string[] = [];
    const getStatusMock = jest
      .fn()
      .mockResolvedValueOnce({ upload_process_state: "CONVERTING" })
      .mockResolvedValueOnce({ upload_process_state: "FAILED" });

    // WHEN starting polling with very short intervals for testing
    const handles = startUploadPolling({
      uploadId: "id",
      pollIntervalMs: 10, // Very short for testing
      maxDurationMs: 60_000,
      getStatus: getStatusMock,
      onStatus: (status) => {
        if (!status) return;
        recordedEvents.push(`status:${status.upload_process_state}`);
      },
      onComplete: (status) => recordedEvents.push(`complete:${status.upload_process_state}`),
      onTerminal: (status) => recordedEvents.push(`terminal:${status.upload_process_state}`),
      onError: (error) => recordedEvents.push(`error:${error}`),
    });

    // Wait for both polls to complete
    await new Promise(resolve => setTimeout(resolve, 30));

    stopUploadPolling(handles);

    // THEN expect the events to reflect the status change and termination
    expect(recordedEvents).toEqual([
      "status:CONVERTING",
      "status:FAILED",
      "terminal:FAILED",
    ]);
  });

  test("polling errors invoke onError and cleanup", async () => {
    // GIVEN a failing getStatus
    const recordedEvents: string[] = [];
    const getStatusMock = jest.fn().mockRejectedValueOnce(new Error("boom"));

    // WHEN starting polling with very short intervals for testing
    const handles = startUploadPolling({
      uploadId: "id",
      pollIntervalMs: 10, // Very short for testing
      maxDurationMs: 60_000,
      getStatus: getStatusMock,
      onStatus: (status) => {
        if (!status) return;
        recordedEvents.push(`status:${status.upload_process_state}`);
      },
      onComplete: (status) => recordedEvents.push(`complete:${status.upload_process_state}`),
      onTerminal: (status) => recordedEvents.push(`terminal:${status.upload_process_state}`),
      onError: (error) => recordedEvents.push(`error:${(error as Error).message}`),
    });

    // Wait for the error to be triggered
    await new Promise(resolve => setTimeout(resolve, 20));
    stopUploadPolling(handles);
    // THEN expect the error to be recorded
    expect(recordedEvents).toEqual(["error:boom"]);
  });

  test("polling respects maxDurationMs timeout", async () => {
    const events: string[] = [];
    const getStatus = jest.fn().mockResolvedValue({ upload_process_state: "CONVERTING" });

    const handles = startUploadPolling({
      uploadId: "id",
      pollIntervalMs: 10, // Very short for testing
      maxDurationMs: 50, // Very short timeout for testing
      getStatus,
      onStatus: (status) => {
        if (!status) return;
        events.push(`status:${status.upload_process_state}`);
      },
      onComplete: (status) => events.push(`complete:${status.upload_process_state}`),
      onTerminal: (status) => events.push(`terminal:${status.upload_process_state}`),
      onError: (error: unknown) => {
        const message = (error as Error)?.message ?? String(error);
        events.push(`error:${message}`);
      },
    });

    // Wait for timeout to trigger
    await new Promise(resolve => setTimeout(resolve, 60));

    stopUploadPolling(handles);
    expect(events).toContain("error:timeout");
  });
});


