import { ConversationMessage } from "./ChatService/ChatService.types";

export type IChatMessage = ConversationMessage &  {
  id: number;
};
