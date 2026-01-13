import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { pushToDataLayer } from "src/services/analytics/dataLayer";
import { GTMChatMessageEvent, GTMConversationCompletedEvent, GTMRegistrationCompleteEvent, GTMRegistrationVisitEvent } from "src/types/gtm";

/**
 * Service for tracking events in Google Tag Manager
 */
export class GTMService {
  /**
   * Tracks a user message sent event in GTM
   * Increments the message counter and pushes event to dataLayer
   * 
   * @param sessionId - The current conversation session ID
   * @param conversationPhase - The current phase of the conversation (e.g., "INTRO", "COLLECT_EXPERIENCES")
   * @param experiencesExplored - Number of experiences explored so far
   */
  static trackMessageSent(
    sessionId: number,
    conversationPhase: string,
    experiencesExplored: number
  ): void {
    // Increment the persistent message counter
    const messageCount = PersistentStorageService.incrementMessageCount();

    const event: GTMChatMessageEvent = {
      event: 'chat_message_sent',
      message_count: messageCount,
      conversation_phase: conversationPhase,
      experiences_explored: experiencesExplored,
      session_id: sessionId,
    };
    pushToDataLayer(event, { session_id: sessionId });

  }

  /**
   * Tracks when a conversation is completed
   * 
   * @param sessionId - The current conversation session ID
   * @param experiencesExplored - Number of experiences explored
   */
  static trackConversationCompleted(
    sessionId: number,
    experiencesExplored: number
  ): void {
    const messageCount = PersistentStorageService.getMessageCount();

    const event: GTMConversationCompletedEvent = {
      event: 'conversation_completed',
      message_count: messageCount,
      experiences_explored: experiencesExplored,
      session_id: sessionId,
    };
    pushToDataLayer(event, { session_id: sessionId });

  }

  static trackRegistrationVisit(registrationCode: string | null, source: GTMRegistrationVisitEvent["source"]): void {
    const event: GTMRegistrationVisitEvent = {
      event: "first_visit",
      registration_code: registrationCode,
      source,
      timestamp: Date.now(),
    };
    pushToDataLayer(event, {
      registration_code_present: Boolean(registrationCode),
      source,
    });
  }

  static trackRegistrationComplete(authMethod: GTMRegistrationCompleteEvent["auth_method"], registrationCode: string | null): void {
    const event: GTMRegistrationCompleteEvent = {
      event: "registration_complete",
      registration_code: registrationCode,
      auth_method: authMethod,
      timestamp: Date.now(),
    };
    pushToDataLayer(event, {
      registration_code_present: Boolean(registrationCode),
      auth_method: authMethod,
    });
  }
}
