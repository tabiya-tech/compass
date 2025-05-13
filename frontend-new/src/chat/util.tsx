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

export const FIXED_MESSAGES_TEXT = {
  AI_IS_TYPING: "Typing...",
  THANK_YOU_FOR_FEEDBACK: "Thank you for taking the time to share your valuable feedback.",
  THANK_YOU_FOR_RATING: "Thank you for rating Compass.",
  SOMETHING_WENT_WRONG:
    "I'm sorry, Something seems to have gone wrong on my end... Can you please refresh the page and try again?",
  PLEASE_REPEAT: "I'm sorry, Something seems to have gone wrong on my end... Can you please repeat that?",
};

export const generateUserMessage = (message: string, sent_at: string, message_id?: string): IChatMessage<UserChatMessageProps> => {
  const payload: UserChatMessageProps = {
    message: message,
    sent_at: sent_at,
  };
  return {
    type: USER_CHAT_MESSAGE_TYPE,
    message_id: message_id ? message_id : nanoid(),
    sender: ConversationMessageSender.USER,
    payload: payload,
    component: (prop: UserChatMessageProps) => <UserChatMessage {...prop}/>,
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
    component: (prop: CompassChatMessageProps) => <CompassChatMessage {...prop}/>,
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
    component: (prop: TypingChatMessageProps) => <TypingChatMessage {...prop}/>,
  };
};

export const generateConversationConclusionMessage = (
  message_id: string,
  message: string,
): IChatMessage<ConversationConclusionChatMessageProps> => {
  const payload: ConversationConclusionChatMessageProps = {
    message: message,
  };
  return {
    type: CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE,
    message_id: message_id,
    sender: ConversationMessageSender.COMPASS,
    payload: payload,
    component: (prop: ConversationConclusionChatMessageProps) => <ConversationConclusionChatMessage {...prop}/>,
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
  }

  if (previousPhase && newPhase.percentage < previousPhase.percentage) {
    console.error(new InvalidConversationPhasePercentage(newPhase.percentage, `less than previous percentage ${previousPhase.percentage}`));
  }

  if (newPhase.percentage > 100) {
    console.error(new InvalidConversationPhasePercentage(newPhase.percentage, "greater than 100"));
    validPhase.percentage = 100;
  }

  if (newPhase.percentage < 0) {
    console.error(new InvalidConversationPhasePercentage(newPhase.percentage, "less than 0"));
    validPhase.percentage = 0;
  }

  return validPhase
}
