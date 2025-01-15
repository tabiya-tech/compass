import { nanoid } from "nanoid";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender, MessageReaction } from "./ChatService/ChatService.types";

export const FIXED_MESSAGES_TEXT = {
  AI_IS_TYPING: "Typing...",
  THANK_YOU: "Thank you for taking the time to share your valuable feedback.",
  SOMETHING_WENT_WRONG:
    "I'm sorry, Something seems to have gone wrong on my end... Can you please refresh the page and try again?",
  PLEASE_REPEAT: "I'm sorry, Something seems to have gone wrong on my end... Can you please repeat that?",
};

export const generateUserMessage = (message: string, sent_at: string, message_id?: string): IChatMessage => {
  return {
    message_id: message_id ? message_id : nanoid(),
    sender: ConversationMessageSender.USER,
    message: message,
    sent_at: sent_at,
    type: ChatMessageType.BASIC_CHAT,
    reaction: null,
  };
};

export const generateCompassMessage = (message_id: string,
  message: string,
  sent_at: string,
  reaction: MessageReaction | null
): IChatMessage => {
  return {
    message_id: message_id,
    sender: ConversationMessageSender.COMPASS,
    message: message,
    sent_at: sent_at,
    type: ChatMessageType.BASIC_CHAT,
    reaction: reaction,
  };
};

export const generateErrorMessage = (
   message: string,
): IChatMessage => {
  return {
    message_id: nanoid(),
    sender: ConversationMessageSender.COMPASS,
    message: message,
    sent_at: new Date().toISOString(),
    type: ChatMessageType.ERROR,
    reaction: null,
  };
};

export const generateTypingMessage = (sent_at: string): IChatMessage => {
  return {
    message_id: nanoid(),
    sender: ConversationMessageSender.COMPASS,
    message: FIXED_MESSAGES_TEXT.AI_IS_TYPING,
    sent_at: sent_at,
    type: ChatMessageType.TYPING,
    reaction: null,
  };
};

export const generateConversationConclusionMessage = (
  message_id: string,
  message: string,
  sent_at: string
): IChatMessage => {
  return {
    message_id: message_id,
    sender: ConversationMessageSender.COMPASS,
    message: message,
    sent_at: sent_at,
    type: ChatMessageType.CONVERSATION_CONCLUSION,
    reaction: null,
  };
};

export const generateSomethingWentWrongMessage = () => {
  return generateErrorMessage(FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG);
};

export const generatePleaseRepeatMessage = () => {
  return generateErrorMessage(FIXED_MESSAGES_TEXT.PLEASE_REPEAT);
};
