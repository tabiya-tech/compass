// Enum for the sender
export enum ConversationMessageSender {
  USER = "USER",
  COMPASS = "COMPASS",
}

// Type for individual conversation messages
export interface ConversationMessage {
  message: string;
  sent_at: string; // ISO formatted datetime string
  sender: ConversationMessageSender; // Either 'USER' or 'COMPASS'
}

export interface ConverstaionResponse {
  messages: ConversationMessage[];
  conversation_completed: boolean;
  conversation_completed_at: string | null; // ISO formatted datetime string
}
