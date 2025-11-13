import { UploadStatus } from "src/chat/Chat.types";
import { getUploadErrorMessage as getCentralizedUploadErrorMessage } from "./CVUploadErrorHandling";

export type UploadPollingHandles = {
  intervalId: ReturnType<typeof setInterval>;
  timeoutId: ReturnType<typeof setTimeout>;
};

export function stopUploadPolling(handles?: UploadPollingHandles): void {
  if (!handles) return;
  clearInterval(handles.intervalId);
  clearTimeout(handles.timeoutId);
}

export function getCvUploadDisplayMessage(status: UploadStatus): string {
  if (!status) return "Uploading CV";
  if (status.upload_process_state === "CANCELLED" || status.cancel_requested) return "CV upload cancelled";
  if (status.upload_process_state === "COMPLETED") {
    // If upload is successful but no experience bullets, show a message indicating no data was found
    if (!status.experience_bullets || status.experience_bullets.length === 0) {
      return "No work experience data found in your CV";
    }
    return "CV uploaded successfully";
  }
  switch (status.upload_process_state) {
    case "CONVERTING":
      return "Converting CV";
    case "UPLOADING_TO_GCS":
      return "Processing CV";
    case "EXTRACTING":
      return "Extracting experiences";
    case "SAVING":
      return "Saving CV";
    case "FAILED":
      return "CV upload failed";
    default:
      return "Uploading CV";
  }
}

export function startUploadPolling(options: {
  uploadId: string;
  pollIntervalMs?: number;
  maxDurationMs?: number;
  getStatus: (uploadId: string) => Promise<UploadStatus | null>;
  onStatus: (status: UploadStatus | null) => void;
  onComplete: (status: UploadStatus) => void;
  onTerminal: (status: UploadStatus) => void;
  onError: (error: unknown) => void;
  isCancelled?: () => boolean;
}): UploadPollingHandles {
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const maxDurationMs = options.maxDurationMs ?? 60_000;

  let handles: UploadPollingHandles = {
    intervalId: undefined as unknown as ReturnType<typeof setInterval>,
    timeoutId: undefined as unknown as ReturnType<typeof setTimeout>,
  };

  const finalize = (cb?: () => void) => {
    stopUploadPolling(handles);
    if (cb) cb();
  };

  const intervalId = setInterval(async () => {
    try {
      if (options.isCancelled?.()) {
        finalize();
        return;
      }
      const status = await options.getStatus(options.uploadId);
      options.onStatus(status);

      const state = status?.upload_process_state;
      if (state === "COMPLETED" && status) {
        finalize(() => options.onComplete(status));
        return;
      }
      if ((state === "FAILED" || state === "CANCELLED") && status) {
        finalize(() => options.onTerminal(status));
        return;
      }
    } catch (e) {
      finalize(() => options.onError(e));
    }
  }, pollIntervalMs);

  const timeoutId = setTimeout(() => {
    finalize(() => options.onError(new Error("timeout")));
  }, maxDurationMs);

  handles = { intervalId, timeoutId };
  return handles;
}

// Re-export the centralized function for backward compatibility
export const getUploadErrorMessage = getCentralizedUploadErrorMessage;
