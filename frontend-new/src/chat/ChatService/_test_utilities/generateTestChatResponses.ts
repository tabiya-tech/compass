import { ConversationMessage, ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

export const generateTestChatResponses = (): ConversationMessage[] => {
  return [
    {
      message: "Hello! How can I help you today?",
      sent_at: new Date().toISOString(),
      sender: ConversationMessageSender.COMPASS
    },
    {
      message: "I can help you with that. What is your name?",
      sent_at: new Date().toISOString(),
      sender: ConversationMessageSender.COMPASS
    },
  ];
};

export const generateTestHistory = (): ConversationMessage[] => {
  return [
      {
        message: "Hello! How can I help you today?",
        sent_at: new Date().toISOString(),
        sender: ConversationMessageSender.COMPASS
      },
      {
        message: "I can help you with that. What is your name?",
        sent_at: new Date().toISOString(),
        sender: ConversationMessageSender.COMPASS
      },
      {
        message: "My name is John.",
        sent_at: new Date().toISOString(),
        sender: ConversationMessageSender.USER
      },
      {
        message: "Nice to meet you, John. How can I help you today?",
        sent_at: new Date().toISOString(),
        sender: ConversationMessageSender.COMPASS
      },
    ];
};
