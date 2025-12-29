// GTM DataLayer type declarations
export interface GTMChatMessageEvent {
  event: 'chat_message_sent';
  message_count: number;
  conversation_phase: string;
  experiences_explored: number;
  session_id: number;
}

export interface GTMConversationCompletedEvent {
  event: 'conversation_completed';
  message_count: number;
  experiences_explored: number;
  session_id: number;
}

type GTMEvent = GTMChatMessageEvent | GTMConversationCompletedEvent;

declare global {
  interface Window {
    dataLayer: GTMEvent[];
  }
}

export {};
