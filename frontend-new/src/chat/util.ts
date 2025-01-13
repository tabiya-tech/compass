import { nanoid } from "nanoid";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "./ChatService/ChatService.types";

export const generateUserMessage = (message: string, sent_at: string): IChatMessage => {
  return {
    id: nanoid(),
    sender: ConversationMessageSender.USER,
    message: message,
    sent_at: sent_at,
    type: ChatMessageType.BASIC_CHAT
  };
};

export const generateCompassMessage = (
  message: string,
  sent_at: string
): IChatMessage => {
  return {
    id: nanoid(),
    sender: ConversationMessageSender.COMPASS,
    message: message,
    sent_at: sent_at,
    type: ChatMessageType.BASIC_CHAT
  };
};

export const generateTypingMessage = (
  sent_at: string,
): IChatMessage => {
  return {
    id: nanoid(),
    sender: ConversationMessageSender.COMPASS,
    message: "Typing...",
    sent_at: sent_at,
    type: ChatMessageType.TYPING
  };
};