import * as Sentry from "@sentry/react";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

export type SupportReference = {
  displayText: string;
  copyPayload: string;
};

export type BuildSupportReferenceInput = {
  error: unknown;
  where: string;
  displayMessage: string;
};

const _describe = (error: unknown): string => {
  if (error instanceof RestAPIError) {
    return `${error.statusCode} ${error.errorCode} ${error.path}`;
  }
  if (error instanceof FirebaseError) {
    return `Firebase ${error.errorCode}`;
  }
  if (error instanceof Error) {
    return error.name ? `${error.name}: ${error.message}` : error.message;
  }
  return "Unknown error";
};

const _activeSessionId = (): string | null => {
  try {
    const id = UserPreferencesStateService.getInstance().getActiveSessionId();
    return id === null ? null : String(id);
  } catch {
    return null;
  }
};

const _sentryEventIdFrom = (error: unknown): string | undefined => {
  if (error instanceof RestAPIError && error.sentryEventId) {
    return error.sentryEventId;
  }
  try {
    return Sentry.lastEventId();
  } catch {
    return undefined;
  }
};

const _correlationIdFrom = (error: unknown): string | undefined => {
  if (error instanceof RestAPIError) {
    return error.correlationId;
  }
  return undefined;
};

export const buildSupportReference = ({
  error,
  where,
  displayMessage,
}: BuildSupportReferenceInput): SupportReference => {
  const lines: string[] = [];
  lines.push(`Error: ${_describe(error)}`);
  lines.push(`Where: ${where}`);

  const correlationId = _correlationIdFrom(error);
  if (correlationId) {
    lines.push(`Reference: ${correlationId}`);
  }

  const sentryEventId = _sentryEventIdFrom(error);
  if (sentryEventId) {
    lines.push(`Sentry: ${sentryEventId}`);
  }

  lines.push(`Time: ${new Date().toISOString()}`);

  const sessionId = _activeSessionId();
  if (sessionId) {
    lines.push(`Session: ${sessionId}`);
  }

  return {
    displayText: displayMessage,
    copyPayload: lines.join("\n"),
  };
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn("Clipboard write failed, falling back to textarea approach", e);
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch (e) {
    console.warn("Textarea clipboard fallback failed", e);
    return false;
  }
};
