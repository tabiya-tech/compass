// Enum for the sender
import { ReactionType } from "src/feedback/reaction/reaction.types";

export enum ConversationMessageSender {
  USER = "USER",
  COMPASS = "COMPASS",
}

export interface ReactionResponse {
  id: string;
  kind: ReactionType | null;
}

// Type for individual conversation messages
export interface ConversationMessage {
  message_id: string;
  message: string;
  sent_at: string; // ISO formatted datetime string
  sender: ConversationMessageSender; // Either 'USER' or 'COMPASS'
  reaction: ReactionResponse | null;
}

export interface ConversationResponse {
  messages: ConversationMessage[];
  conversation_completed: boolean;
  conversation_conducted_at: string | null; // ISO formatted datetime string
  experiences_explored: number; // a count for all the experiences explored (processed)
}
