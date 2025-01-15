import { ConversationMessage, ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";

export const generateTestChatResponses = (): ConversationMessage[] => {
  return [
    {
      message_id: nanoid(),
      message: "Hello! How can I help you today?",
      sent_at: new Date().toISOString(),
      sender: ConversationMessageSender.COMPASS,
    },
    {
      message_id: nanoid(),
      message: "I can help you with that. What is your name?",
      sent_at: new Date().toISOString(),
      sender: ConversationMessageSender.COMPASS,
    },
  ];
};

export const generateTestHistory = (): ConversationMessage[] => {
  return [
    {
      message_id: nanoid(),
      message: "Hello! How can I help you today?",
      sent_at: new Date().toISOString(),
      sender: ConversationMessageSender.COMPASS,
    },
    {
      message_id: nanoid(),
      message: "I can help you with that. What is your name?",
      sent_at: new Date().toISOString(),
      sender: ConversationMessageSender.COMPASS,
    },
    {
      message_id: nanoid(),
      message: "My name is John.",
      sent_at: new Date().toISOString(),
      sender: ConversationMessageSender.USER,
    },
    {
      message_id: nanoid(),
      message: "Nice to meet you, John. How can I help you today?",
      sent_at: new Date().toISOString(),
      sender: ConversationMessageSender.COMPASS,
    },
  ];
};
