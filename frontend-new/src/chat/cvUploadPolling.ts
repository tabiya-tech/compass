import { UploadProcessState } from "src/chat/Chat.types";

export type UploadPollingHandles = {
  intervalId: ReturnType<typeof setInterval>;
  timeoutId: ReturnType<typeof setTimeout>;
};

export interface UploadStatus {
  upload_process_state: UploadProcessState;
  cancel_requested?: boolean;
  filename?: string;
  user_id?: string;
  upload_id?: string;
  created_at?: string;
  last_activity_at?: string;
  error_code?: string | null;
  error_detail?: string | null;
  experience_bullets?: string[] | null;
}

export function stopUploadPolling(handles?: UploadPollingHandles): void {
  if (!handles) return;
  clearInterval(handles.intervalId);
  clearTimeout(handles.timeoutId);
}

export function getCvUploadDisplayMessage(status: UploadStatus): string {
  if (!status) return "Uploading CV";
  if (status.upload_process_state === "CANCELLED" || status.cancel_requested) return "CV upload cancelled";
  if (status.upload_process_state === "COMPLETED") return "CV uploaded successfully";
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

export const getUploadErrorMessage = (status: number, detail?: string): string => {
  switch (status) {
    case 401:
    case 403:
      return "You are not authorized. Please sign in again.";
    case 404:
      return "Upload not found. It may have failed to start.";
    case 413:
      return "File too large. Please upload a smaller CV.";
    case 415:
      return "Unsupported file type. Allowed: PDF, DOCX, TXT.";
    case 429:
      return "You are uploading too fast. Please wait and try again.";
    case 408:
    case 504:
      return "The upload timed out. Please try again.";
    case 409:
      return "This CV seems to have been uploaded already.";
    case 500:
    default:
      return detail || "We couldn't process your CV right now. Please try again.";
  }
};
