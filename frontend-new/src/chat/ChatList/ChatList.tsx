import React from "react";
import { IChatMessage } from "src/chat/Chat.types";

const uniqueId = "0397ee51-f637-4453-9e2f-5cc8900c9554";
export const DATA_TEST_ID = {
  CHAT_LIST_CONTAINER: `chat-list-container-${uniqueId}`,
};

export type ChatListProps = {
  messages: IChatMessage[];
  sendMessage: (message: string) => void;
  clearMessages: () => void;
  isTyping: boolean;
};

const ChatList: React.FC<ChatListProps> = ({ messages, clearMessages, sendMessage, isTyping }) => {
  return <div data-testid={DATA_TEST_ID.CHAT_LIST_CONTAINER}></div>;
};

export default ChatList;
