import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "./ChatService/ChatService.types";

export const generateUserMessage = (message: string, sent_at: string): IChatMessage => {
  return {
    id: Math.floor(Math.random() * 1000),
    sender: ConversationMessageSender.USER,
    message: message,
    sent_at: sent_at,
  };
};

export const generateCompassMessage = (message: string, sent_at: string): IChatMessage => {
  return {
    id: Math.floor(Math.random() * 1000),
    sender: ConversationMessageSender.COMPASS,
    message: message,
    sent_at: sent_at,
  };
};
