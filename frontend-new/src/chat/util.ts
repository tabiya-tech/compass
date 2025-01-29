import { nanoid } from "nanoid";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender, ReactionResponse } from "./ChatService/ChatService.types";

export const generateUserMessage = (message: string, sent_at: string): IChatMessage => {
  return {
    message_id: nanoid(),
    sender: ConversationMessageSender.USER,
    message: message,
    sent_at: sent_at,
    type: ChatMessageType.BASIC_CHAT,
    reaction: null,
  };
};

export const generateCompassMessage = (
  message_id: string,
  message: string,
  sent_at: string,
  reaction: ReactionResponse | null
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

export const generateTypingMessage = (sent_at: string): IChatMessage => {
  return {
    message_id: nanoid(),
    sender: ConversationMessageSender.COMPASS,
    message: "Typing...",
    sent_at: sent_at,
    type: ChatMessageType.TYPING,
    reaction: null,
  };
};
