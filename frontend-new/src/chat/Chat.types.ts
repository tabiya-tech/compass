import { ConversationMessage, MessageReaction } from "./ChatService/ChatService.types";

export enum ChatMessageType {
  BASIC_CHAT = "basic_chat",
  CONVERSATION_CONCLUSION = "conversation_conclusion",
  TYPING = "typing",
  ERROR = "error",
}

export type IChatMessage = ConversationMessage & {
  type: ChatMessageType;
  reaction: MessageReaction | null;
};
