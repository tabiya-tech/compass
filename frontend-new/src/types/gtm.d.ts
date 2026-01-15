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

export interface GTMRegistrationVisitEvent {
  event: 'first_visit';
  registration_code: string | null;
  source: 'secure_link' | 'manual' | 'unknown';
  timestamp: number;
}

export interface GTMRegistrationCompleteEvent {
  event: 'registration_complete';
  registration_code: string | null;
  auth_method: 'email' | 'google' | 'unknown';
  timestamp: number;
}

export interface GTMUserIdentitySetEvent {
  event: 'user_identity_set';
  user_id: string;
  identifier_type: 'registration_code' | 'user_id';
  registration_code?: string | null;
  auth_state: 'logged_in';
  source?: 'secure_link' | 'legacy' | 'unknown';
}

export interface GTMUserIdentityClearedEvent {
  event: 'user_identity_cleared';
  auth_state: 'logged_out';
}

type GTMEvent =
  | GTMChatMessageEvent
  | GTMConversationCompletedEvent
  | GTMRegistrationVisitEvent
  | GTMRegistrationCompleteEvent
  | GTMUserIdentitySetEvent
  | GTMUserIdentityClearedEvent;

declare global {
  interface Window {
    dataLayer: GTMEvent[];
  }
}

export {};
