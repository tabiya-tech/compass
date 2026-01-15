import type {
  GTMChatMessageEvent,
  GTMConversationCompletedEvent,
  GTMRegistrationCompleteEvent,
  GTMRegistrationVisitEvent,
  GTMUserIdentityClearedEvent,
  GTMUserIdentitySetEvent,
} from "src/types/gtm";

export type DataLayerEvent =
  | GTMChatMessageEvent
  | GTMConversationCompletedEvent
  | GTMRegistrationVisitEvent
  | GTMRegistrationCompleteEvent
  | GTMUserIdentitySetEvent
  | GTMUserIdentityClearedEvent;

type LoggerContext = Record<string, unknown> | undefined;

const redactContext = (context: LoggerContext): LoggerContext => {
  if (!context) return undefined;
  return Object.keys(context).reduce<Record<string, string>>((acc, key) => {
    acc[key] = "[redacted]";
    return acc;
  }, {});
};

export const pushToDataLayer = (event: DataLayerEvent, context?: LoggerContext): void => {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
  } catch (error) {
    // Avoid logging raw event payloads to prevent accidental PII exposure
    const safeContext = redactContext(context);
    /* eslint-disable no-console */
    console.warn(`dataLayer push failed for event=${event.event}`, safeContext);
    console.debug(error);
    /* eslint-enable no-console */
  }
};
