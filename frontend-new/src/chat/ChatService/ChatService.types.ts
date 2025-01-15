// Enum for the sender
export enum ConversationMessageSender {
  USER = "USER",
  COMPASS = "COMPASS",
}

// Type for individual conversation messages
export interface ConversationMessage {
  message_id: string;
  message: string;
  sent_at: string; // ISO formatted datetime string
  sender: ConversationMessageSender; // Either 'USER' or 'COMPASS'
}

export interface ConversationResponse {
  messages: ConversationMessage[];
  conversation_completed: boolean;
  conversation_conducted_at: string | null; // ISO formatted datetime string
  experiences_explored: number; // a count for all the experiences explored (processed)
}
