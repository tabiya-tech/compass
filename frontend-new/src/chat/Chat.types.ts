import { ConversationMessage } from "./ChatService/ChatService.types";
import { ChatMessageFooterType } from "./ChatMessage/ChatMessage";

export type IChatMessage = ConversationMessage & {
  id: string;
  footerType?: ChatMessageFooterType;
  isTypingMessage?: boolean;
};

export type TNewSesionResponse = {
  session_id: number;
};
