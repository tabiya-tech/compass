import { ConversationMessage } from "./ChatService/ChatService.types";
import { ChatMessageFooterType } from "./ChatMessage/ChatMessage";
import { ReactionType } from "src/feedback/reaction/reaction.types";

export type IChatMessage = ConversationMessage & {
  id: string;
  footerType?: ChatMessageFooterType;
  isTypingMessage?: boolean;
  reaction?: ReactionType;
};
