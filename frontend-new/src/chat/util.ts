import { ChatMessageOrigin, IChatMessage } from "src/chat/Chat.types";

export const generateUserMessage = (message: string): IChatMessage => {
  return {
    id: Math.floor(Math.random() * 1000),
    origin: ChatMessageOrigin.ME,
    message: message,
    timestamp: Date.now(),
  };
};

export const generateCompassMessage = (message: string): IChatMessage => {
  return {
    id: Math.floor(Math.random() * 1000),
    origin: ChatMessageOrigin.COMPASS,
    message: message,
    timestamp: Date.now(),
  };
};