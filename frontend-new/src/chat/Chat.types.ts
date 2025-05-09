import { ConversationMessage } from "./ChatService/ChatService.types";
import { ReactElement } from "react";

export enum ChatMessageType {
  BASIC_CHAT = "basic_chat",
  CONVERSATION_CONCLUSION = "conversation_conclusion",
  TYPING = "typing",
  ERROR = "error",
}

export type IChatMessage = ConversationMessage & {
  type: ChatMessageType;
  component: ReactElement;
};
