import { useCallback } from "react";
import ChatService from "src/chat/ChatService/ChatService";
import { ConversationResponse } from "src/chat/ChatService/ChatService.types";
import { IChatMessage } from "src/chat/Chat.types";
import { generateUserMessage, formatCvExperienceBulletsMessage } from "src/chat/util";
import { ChatError } from "src/error/commonErrors";

export interface CvBulletsHandlerOptions {
  // Required dependencies
  sessionId: number | null;
  addMessageToChat: (message: IChatMessage<any>) => void;
  setAiIsTyping: (isTyping: boolean) => void;
  processChatHistoryResponse: (
    response: ConversationResponse,
    options: {
      skipUserMessage?: string;
      sessionId: number;
    }
  ) => Promise<void>;
}

export interface CvBulletsHandlerResult {
  /**
   * Formats experience bullets into a user message string
   */
  formatBulletsMessage: (bullets: string[]) => string;

  /**
   * Sends CV experience bullets as a user message and processes the response.
   * Used for upload completion flow.
   */
  handleBullets: (bullets: string[]) => Promise<void>;

  /**
   * Refreshes chat after CV bullets are sent (for reinjection flow).
   * Can accept the sendMessage response to avoid fetching full history.
   */
  handleBulletsSent: (bulletsMessage?: string, sendMessageResponse?: ConversationResponse) => Promise<void>;
}

/**
 * Custom hook to consolidate CV bullets handling logic for upload and reinjection flows.
 * 
 * This hook provides:
 * - Formatting bullets into message strings
 * - Sending bullets as user messages
 * - Processing chat history responses
 * - Managing typing indicators
 * 
 * @param options - Configuration object with required dependencies
 * @returns Handler functions for CV bullets operations
 */
export const useCvBulletsHandler = (options: CvBulletsHandlerOptions): CvBulletsHandlerResult => {
  const { sessionId, addMessageToChat, setAiIsTyping, processChatHistoryResponse } = options;

  const formatBulletsMessage = useCallback((bullets: string[]): string => {
    return formatCvExperienceBulletsMessage(bullets);
  }, []);

  const handleBullets = useCallback(
    async (bullets: string[]): Promise<void> => {
      if (sessionId == null) {
        throw new ChatError("Session ID is not available");
      }

      const message = formatBulletsMessage(bullets);

      // Show the user message immediately before sending
      addMessageToChat(generateUserMessage(message, new Date().toISOString()));
      // Show typing indicator while waiting for backend response
      setAiIsTyping(true);

      try {
        // Send to server - the response contains only new messages, not the full history
        const response = await ChatService.getInstance().sendMessage(sessionId, message);
        await processChatHistoryResponse(response, { skipUserMessage: message, sessionId });
      } catch (err) {
        console.error(new ChatError("Failed to send experience bullets message:", err));
        throw err;
      } finally {
        setAiIsTyping(false);
      }
    },
    [sessionId, formatBulletsMessage, addMessageToChat, setAiIsTyping, processChatHistoryResponse]
  );

  const handleBulletsSent = useCallback(
    async (bulletsMessage?: string, sendMessageResponse?: ConversationResponse): Promise<void> => {
      if (sessionId == null) return;

      try {
        // Show the user message immediately if provided
        if (bulletsMessage) {
          addMessageToChat(generateUserMessage(bulletsMessage, new Date().toISOString()));
        }

        // Use the response from sendMessage if provided (contains only new messages),
        // otherwise fetch history. processChatHistoryResponse handles duplicate filtering internally.
        const response = sendMessageResponse || await ChatService.getInstance().getChatHistory(sessionId);
        await processChatHistoryResponse(response, { skipUserMessage: bulletsMessage, sessionId });
      } catch (e) {
        console.error(new ChatError("Failed to refresh chat after CV bullets sent:", e));
      }
    },
    [sessionId, addMessageToChat, processChatHistoryResponse]
  );

  return {
    formatBulletsMessage,
    handleBullets,
    handleBulletsSent,
  };
};

