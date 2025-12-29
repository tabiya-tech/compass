import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { GTMChatMessageEvent, GTMConversationCompletedEvent } from "src/types/gtm";

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

    // Initialize dataLayer if it doesn't exist
    window.dataLayer = window.dataLayer || [];

    // Push the event to GTM
    const event: GTMChatMessageEvent = {
      event: 'chat_message_sent',
      message_count: messageCount,
      conversation_phase: conversationPhase,
      experiences_explored: experiencesExplored,
      session_id: sessionId,
    };

    window.dataLayer.push(event);

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

    // Initialize dataLayer if it doesn't exist
    window.dataLayer = window.dataLayer || [];

    // Push the event to GTM
    const event: GTMConversationCompletedEvent = {
      event: 'conversation_completed',
      message_count: messageCount,
      experiences_explored: experiencesExplored,
      session_id: sessionId,
    };

    window.dataLayer.push(event);

  }
}
