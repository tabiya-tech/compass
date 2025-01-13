import { ConversationMessage } from "./ChatService/ChatService.types";

export enum ChatMessageType {
  BASIC_CHAT = "basic_chat",
  CONVERSATION_CONCLUSION = "conversation_conclusion",
  TYPING = "typing"
}

export type IChatMessage = ConversationMessage & {
  id: string;
  type: ChatMessageType;
};