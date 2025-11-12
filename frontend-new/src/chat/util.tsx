import { nanoid } from "nanoid";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender, MessageReaction } from "./ChatService/ChatService.types";
import { CurrentPhase } from "src/chat/chatProgressbar/types";
import { InvalidConversationPhasePercentage } from "./errors";
import UserChatMessage, { UserChatMessageProps, USER_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import CompassChatMessage, { CompassChatMessageProps, COMPASS_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import ConversationConclusionChatMessage, { ConversationConclusionChatMessageProps, CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import TypingChatMessage, { TypingChatMessageProps, TYPING_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import ErrorChatMessage, { ErrorChatMessageProps, ERROR_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/errorChatMessage/ErrorChatMessage";
import CVTypingChatMessage, { CV_TYPING_CHAT_MESSAGE_TYPE, CVTypingChatMessageProps } from "src/CV/CVTypingChatMessage/CVTypingChatMessage";
import CancellableTypingChatMessage, { CancellableTypingChatMessageProps } from "src/chat/chatMessage/cancellableTypingChatMessage/CancellableTypingChatMessage";
import i18n from "src/i18n/i18n";

const uniqueId = "cancellable-cv-typing-message-2a76494f-351d-409d-ba58-e1b2cfaf2a53";
export const CANCELLABLE_CV_TYPING_CHAT_MESSAGE_TYPE = `cancellable-cv-typing-message-${uniqueId}`;

// Translated messages (resolved at access-time to respect runtime language changes)
export const FIXED_MESSAGES_TEXT = {
  get AI_IS_TYPING() {
    return i18n.t("chat.chatMessage.typingChatMessage.typing");
  },
  get THANK_YOU_FOR_FEEDBACK() {
    return i18n.t("chat.util.feedbackThankYou");
  },
  get THANK_YOU_FOR_RATING() {
    return i18n.t("chat.util.ratingThankYou");
  },
  get SOMETHING_WENT_WRONG() {
    return i18n.t("chat.util.errorSomethingWentWrong");
  },
  get PLEASE_REPEAT() {
    return i18n.t("chat.util.errorPleaseRepeat");
  },
};

export const generateUserMessage = (
  message: string,
  sent_at: string,
  message_id?: string
): IChatMessage<UserChatMessageProps> => {
  const payload: UserChatMessageProps = {
    message: message,
    sent_at: sent_at,
  };
  return {
    type: USER_CHAT_MESSAGE_TYPE,
    message_id: message_id ? message_id : nanoid(),
    sender: ConversationMessageSender.USER,
    payload: payload,
    component: (prop: UserChatMessageProps) => <UserChatMessage {...prop} />,
  };
};

export const generateCompassMessage = (
  message_id: string,
  message: string,
  sent_at: string,
  reaction: MessageReaction | null
): IChatMessage<CompassChatMessageProps> => {
  const payload: CompassChatMessageProps = {
    message_id: message_id,
    message: message,
    sent_at: sent_at,
    reaction: reaction,
  };
  return {
    type: COMPASS_CHAT_MESSAGE_TYPE,
    message_id: message_id,
    sender: ConversationMessageSender.COMPASS,
    payload: payload,
    component: (prop: CompassChatMessageProps) => <CompassChatMessage {...prop} />,
  };
};

export const generateErrorMessage = (message: string): IChatMessage<ErrorChatMessageProps> => {
  const payload: ErrorChatMessageProps = {
    message: message,
  };
  return {
    type: ERROR_CHAT_MESSAGE_TYPE,
    message_id: nanoid(),
    sender: ConversationMessageSender.COMPASS,
    payload: payload,
    component: (prop: ErrorChatMessageProps) => <ErrorChatMessage {...prop} />,
  };
};

export const generateTypingMessage = (waitBeforeThinking?: number): IChatMessage<TypingChatMessageProps> => {
  const payload: TypingChatMessageProps = {
    waitBeforeThinking: waitBeforeThinking,
  };
  return {
    type: TYPING_CHAT_MESSAGE_TYPE,
    message_id: nanoid(),
    sender: ConversationMessageSender.COMPASS,
    payload: payload,
    component: (prop: TypingChatMessageProps) => <TypingChatMessage {...prop} />,
  };
};

// Generate a CV typing message
export const generateCVTypingMessage = (isUploaded = false): IChatMessage<CVTypingChatMessageProps> => {
  const payload: CVTypingChatMessageProps = {
    isUploaded: isUploaded,
  };

  return {
    type: CV_TYPING_CHAT_MESSAGE_TYPE,
    message_id: nanoid(),
    payload: payload,
    sender: ConversationMessageSender.COMPASS,
    component: (prop: CVTypingChatMessageProps) => <CVTypingChatMessage {...prop} />,
  };
};

// Generate a cancellable CV typing message
export const generateCancellableCVTypingMessage = (
  uploadId: string,
  onCancel: (uploadId: string) => Promise<void>,
  isUploaded = false,
  isCancelled = false,
  uploadState?: string
): IChatMessage<CancellableTypingChatMessageProps> => {
  const getDisplayMessage = (): string => {
    if (isCancelled) return i18n.t("chat.cvUploadPolling.cancelled");
    if (isUploaded) return i18n.t("chat.cvUploadPolling.uploadedSuccessfully");

    switch (uploadState) {
      case "CONVERTING":
        return i18n.t("chat.cvUploadPolling.converting");
      case "UPLOADING_TO_GCS":
        return i18n.t("chat.cvUploadPolling.processing");
      case "EXTRACTING":
        return i18n.t("chat.cvUploadPolling.extractingExperiences");
      case "SAVING":
        return i18n.t("chat.cvUploadPolling.savingCv");
      case "FAILED":
        return i18n.t("chat.cvUploadPolling.failed");
      default:
        return i18n.t("chat.cvUploadPolling.uploadingCv");
    }
  };

  const payload: CancellableTypingChatMessageProps = {
    message: getDisplayMessage(),
    thinkingMessage: i18n.t("chat.cvUploadPolling.thinkingMessage"),
    waitBeforeThinking: 10000, // 10 seconds for CV processing
    disabled: isUploaded || isCancelled,
    onCancel: async () => await onCancel(uploadId),
  };

  return {
    type: CANCELLABLE_CV_TYPING_CHAT_MESSAGE_TYPE,
    message_id: nanoid(),
    payload: payload,
    sender: ConversationMessageSender.COMPASS,
    component: (prop: CancellableTypingChatMessageProps) => <CancellableTypingChatMessage {...prop} />,
  };
};

export const generateConversationConclusionMessage = (
  message_id: string,
  message: string
): IChatMessage<ConversationConclusionChatMessageProps> => {
  const payload: ConversationConclusionChatMessageProps = {
    message: message,
  };
  return {
    type: CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE,
    message_id: message_id,
    sender: ConversationMessageSender.COMPASS,
    payload: payload,
    component: (prop: ConversationConclusionChatMessageProps) => <ConversationConclusionChatMessage {...prop} />,
  };
};

export const generateSomethingWentWrongMessage = () => {
  return generateErrorMessage(FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG);
};

export const generatePleaseRepeatMessage = () => {
  return generateErrorMessage(FIXED_MESSAGES_TEXT.PLEASE_REPEAT);
};

/**
 * Parses the conversation phase and ensures that the percentage is valid, if not valid
 * a warning is logged, and the percentage is set to the previous phase percentage.
 *
 * @param previousPhase
 * @param newPhase
 */
export const parseConversationPhase = (newPhase: CurrentPhase, previousPhase?: CurrentPhase): CurrentPhase => {
  let validPhase: CurrentPhase = {
    phase: newPhase.phase,
    percentage: newPhase.percentage,
    current: newPhase.current,
    total: newPhase.total,
  };

  if (previousPhase && newPhase.percentage < previousPhase.percentage) {
    console.error(
      new InvalidConversationPhasePercentage(
        newPhase.percentage,
        `less than previous percentage ${previousPhase.percentage}`
      )
    );
  }

  if (newPhase.percentage > 100) {
    console.error(new InvalidConversationPhasePercentage(newPhase.percentage, "greater than 100"));
    validPhase.percentage = 100;
  }

  if (newPhase.percentage < 0) {
    console.error(new InvalidConversationPhasePercentage(newPhase.percentage, "less than 0"));
    validPhase.percentage = 0;
  }

  return validPhase;
};

export const formatExperiencesToMessage = (experiences: string[] | null): string => {
  if (!Array.isArray(experiences) || experiences.length === 0) return "";

  const intro = i18n.t("chat.util.messages.experiencesIntro");
  const bullets = experiences
    .map((s) => (s?.trim()?.length ? `• ${s.trim()}` : ""))
    .filter(Boolean)
    .join("\n");
  return bullets ? `${intro}\n${bullets}` : intro;
};
