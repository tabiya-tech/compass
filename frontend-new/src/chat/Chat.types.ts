import { ConversationMessage, MessageReaction } from "./ChatService/ChatService.types";

export enum ChatMessageType {
  BASIC_CHAT = "basic_chat",
  CONVERSATION_CONCLUSION = "conversation_conclusion",
  TYPING = "typing",
  ERROR = "error",
  SKILLS_RANKING = "skills_ranking",
}

export type IChatMessage = ConversationMessage & {
  type: ChatMessageType;
  reaction: MessageReaction | null;
};
