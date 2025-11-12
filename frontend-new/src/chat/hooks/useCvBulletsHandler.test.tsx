// mute the console
import "src/_test_utilities/consoleMock";

import { act, renderHook } from "src/_test_utilities/test-utils";
import { useCvBulletsHandler } from "./useCvBulletsHandler";
import ChatService from "src/chat/ChatService/ChatService";
import { ConversationResponse, ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { IChatMessage } from "src/chat/Chat.types";
import { ChatError } from "src/error/commonErrors";
import { formatCvExperienceBulletsMessage } from "src/chat/util";
import { CurrentPhase, ConversationPhase } from "src/chat/chatProgressbar/types";

describe("useCvBulletsHandler", () => {
  const mockSessionId = 123;
  let mockAddMessageToChat: jest.Mock;
  let mockSetAiIsTyping: jest.Mock;
  let mockProcessChatHistoryResponse: jest.Mock;
  let mockSendMessage: jest.Mock;
  let mockGetChatHistory: jest.Mock;

  const createMockConversationResponse = (
    messages: Array<{ message_id: string; message: string; sender: ConversationMessageSender }> = []
  ): ConversationResponse => ({
    messages: messages.map((msg) => ({
      message_id: msg.message_id,
      message: msg.message,
      sent_at: new Date().toISOString(),
      sender: msg.sender,
      reaction: null,
    })),
    conversation_completed: false,
    conversation_conducted_at: null,
    experiences_explored: 0,
    current_phase: {
      phase: ConversationPhase.COLLECT_EXPERIENCES,
      percentage: 0,
      current: 0,
      total: 0,
    } as CurrentPhase,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAddMessageToChat = jest.fn();
    mockSetAiIsTyping = jest.fn();
    mockProcessChatHistoryResponse = jest.fn().mockResolvedValue(undefined);
    mockSendMessage = jest.fn();
    mockGetChatHistory = jest.fn();

    jest.spyOn(ChatService, "getInstance").mockReturnValue({
      sendMessage: mockSendMessage,
      getChatHistory: mockGetChatHistory,
    } as unknown as ChatService);
  });

  describe("formatBulletsMessage", () => {
    test("should format bullets into a message string", () => {
      // GIVEN the useCvBulletsHandler hook
      const { result } = renderHook(() =>
        useCvBulletsHandler({
          sessionId: mockSessionId,
          addMessageToChat: mockAddMessageToChat,
          setAiIsTyping: mockSetAiIsTyping,
          processChatHistoryResponse: mockProcessChatHistoryResponse,
        })
      );

      // WHEN formatting bullets
      const bullets = ["Worked as a software engineer", "Built web applications", "Led a team of 5"];
      const formatted = result.current.formatBulletsMessage(bullets);

      // THEN expect the formatted message to match the utility function
      expect(formatted).toBe(formatCvExperienceBulletsMessage(bullets));
      expect(formatted).toContain("I have these experiences:");
      expect(formatted).toContain("• Worked as a software engineer");
      expect(formatted).toContain("• Built web applications");
      expect(formatted).toContain("• Led a team of 5");
      expect(formatted).toContain("Let's start with these.");
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle empty bullets array", () => {
      // GIVEN the useCvBulletsHandler hook
      const { result } = renderHook(() =>
        useCvBulletsHandler({
          sessionId: mockSessionId,
          addMessageToChat: mockAddMessageToChat,
          setAiIsTyping: mockSetAiIsTyping,
          processChatHistoryResponse: mockProcessChatHistoryResponse,
        })
      );

      // WHEN formatting an empty array
      const formatted = result.current.formatBulletsMessage([]);

      // THEN expect the formatted message to match the utility function
      expect(formatted).toBe(formatCvExperienceBulletsMessage([]));
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("handleBullets", () => {
    test("should send bullets as a user message and process the response", async () => {
      // GIVEN bullets to send and a mock response
      const bullets = ["Worked as a software engineer", "Built web applications"];
      const mockResponse = createMockConversationResponse([
        {
          message_id: "msg-1",
          message: "Great! Let's explore these experiences.",
          sender: ConversationMessageSender.COMPASS,
        },
      ]);
      mockSendMessage.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useCvBulletsHandler({
          sessionId: mockSessionId,
          addMessageToChat: mockAddMessageToChat,
          setAiIsTyping: mockSetAiIsTyping,
          processChatHistoryResponse: mockProcessChatHistoryResponse,
        })
      );

      // WHEN handling bullets
      await act(async () => {
        await result.current.handleBullets(bullets);
      });

      // THEN expect the user message to be added optimistically
      expect(mockAddMessageToChat).toHaveBeenCalledTimes(1);
      const addedMessage = mockAddMessageToChat.mock.calls[0][0] as IChatMessage<any>;
      expect(addedMessage.sender).toBe(ConversationMessageSender.USER);
      expect(addedMessage.payload.message).toContain("I have these experiences:");

      // AND the typing indicator to be set and then cleared
      expect(mockSetAiIsTyping).toHaveBeenCalledWith(true);
      expect(mockSetAiIsTyping).toHaveBeenCalledWith(false);

      // AND the message to be sent to the server
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(mockSessionId, formatCvExperienceBulletsMessage(bullets));

      // AND the response to be processed
      expect(mockProcessChatHistoryResponse).toHaveBeenCalledTimes(1);
      expect(mockProcessChatHistoryResponse).toHaveBeenCalledWith(mockResponse, {
        skipUserMessage: formatCvExperienceBulletsMessage(bullets),
        sessionId: mockSessionId,
      });
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw error when sessionId is null", async () => {
      // GIVEN the hook with null sessionId
      const { result } = renderHook(() =>
        useCvBulletsHandler({
          sessionId: null,
          addMessageToChat: mockAddMessageToChat,
          setAiIsTyping: mockSetAiIsTyping,
          processChatHistoryResponse: mockProcessChatHistoryResponse,
        })
      );

      // WHEN handling bullets
      // THEN expect an error to be thrown
      await act(async () => {
        await expect(result.current.handleBullets(["bullet"])).rejects.toThrow(ChatError);
      });

      // AND no message to be added
      expect(mockAddMessageToChat).not.toHaveBeenCalled();
      // AND no message to be sent
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle errors and reset typing indicator", async () => {
      // GIVEN bullets to send and a network error
      const bullets = ["Worked as a software engineer"];
      const error = new Error("Network error");
      mockSendMessage.mockRejectedValue(error);

      const { result } = renderHook(() =>
        useCvBulletsHandler({
          sessionId: mockSessionId,
          addMessageToChat: mockAddMessageToChat,
          setAiIsTyping: mockSetAiIsTyping,
          processChatHistoryResponse: mockProcessChatHistoryResponse,
        })
      );

      // WHEN handling bullets
      // THEN expect an error to be thrown
      await act(async () => {
        await expect(result.current.handleBullets(bullets)).rejects.toThrow("Network error");
      });

      // AND the message to still be added optimistically
      expect(mockAddMessageToChat).toHaveBeenCalledTimes(1);

      // AND the typing indicator to be set and then reset even on error
      expect(mockSetAiIsTyping).toHaveBeenCalledWith(true);
      expect(mockSetAiIsTyping).toHaveBeenCalledWith(false);

      // AND the response not to be processed
      expect(mockProcessChatHistoryResponse).not.toHaveBeenCalled();
      // AND errors should be logged
      expect(console.error).toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("handleBulletsSent", () => {
    test("should refresh chat using sendMessageResponse when provided", async () => {
      // GIVEN a bullets message and a sendMessage response
      const bulletsMessage = formatCvExperienceBulletsMessage(["Worked as a software engineer"]);
      const mockSendMessageResponse = createMockConversationResponse([
        {
          message_id: "msg-1",
          message: "Great! Let's explore these experiences.",
          sender: ConversationMessageSender.COMPASS,
        },
      ]);

      const { result } = renderHook(() =>
        useCvBulletsHandler({
          sessionId: mockSessionId,
          addMessageToChat: mockAddMessageToChat,
          setAiIsTyping: mockSetAiIsTyping,
          processChatHistoryResponse: mockProcessChatHistoryResponse,
        })
      );

      // WHEN handling bullets sent with a response
      await act(async () => {
        await result.current.handleBulletsSent(bulletsMessage, mockSendMessageResponse);
      });

      // THEN expect the user message to be added if provided
      expect(mockAddMessageToChat).toHaveBeenCalledTimes(1);
      const addedMessage = mockAddMessageToChat.mock.calls[0][0] as IChatMessage<any>;
      expect(addedMessage.sender).toBe(ConversationMessageSender.USER);
      expect(addedMessage.payload.message).toBe(bulletsMessage);

      // AND chat history not to be fetched
      expect(mockGetChatHistory).not.toHaveBeenCalled();

      // AND the response to be processed
      expect(mockProcessChatHistoryResponse).toHaveBeenCalledTimes(1);
      expect(mockProcessChatHistoryResponse).toHaveBeenCalledWith(mockSendMessageResponse, {
        skipUserMessage: bulletsMessage,
        sessionId: mockSessionId,
      });
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should fetch chat history when sendMessageResponse is not provided", async () => {
      // GIVEN a bullets message but no sendMessage response
      const bulletsMessage = formatCvExperienceBulletsMessage(["Worked as a software engineer"]);
      const mockHistoryResponse = createMockConversationResponse([
        {
          message_id: "msg-1",
          message: "Great! Let's explore these experiences.",
          sender: ConversationMessageSender.COMPASS,
        },
      ]);
      mockGetChatHistory.mockResolvedValue(mockHistoryResponse);

      const { result } = renderHook(() =>
        useCvBulletsHandler({
          sessionId: mockSessionId,
          addMessageToChat: mockAddMessageToChat,
          setAiIsTyping: mockSetAiIsTyping,
          processChatHistoryResponse: mockProcessChatHistoryResponse,
        })
      );

      // WHEN handling bullets sent without a response
      await act(async () => {
        await result.current.handleBulletsSent(bulletsMessage);
      });

      // THEN expect chat history to be fetched
      expect(mockGetChatHistory).toHaveBeenCalledTimes(1);
      expect(mockGetChatHistory).toHaveBeenCalledWith(mockSessionId);

      // AND the response to be processed
      expect(mockProcessChatHistoryResponse).toHaveBeenCalledTimes(1);
      expect(mockProcessChatHistoryResponse).toHaveBeenCalledWith(mockHistoryResponse, {
        skipUserMessage: bulletsMessage,
        sessionId: mockSessionId,
      });
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle case when bulletsMessage is not provided", async () => {
      // GIVEN no bullets message
      const mockHistoryResponse = createMockConversationResponse([
        {
          message_id: "msg-1",
          message: "Great! Let's explore these experiences.",
          sender: ConversationMessageSender.COMPASS,
        },
      ]);
      mockGetChatHistory.mockResolvedValue(mockHistoryResponse);

      const { result } = renderHook(() =>
        useCvBulletsHandler({
          sessionId: mockSessionId,
          addMessageToChat: mockAddMessageToChat,
          setAiIsTyping: mockSetAiIsTyping,
          processChatHistoryResponse: mockProcessChatHistoryResponse,
        })
      );

      // WHEN handling bullets sent without a message
      await act(async () => {
        await result.current.handleBulletsSent();
      });

      // THEN expect no user message to be added
      expect(mockAddMessageToChat).not.toHaveBeenCalled();

      // AND chat history to be fetched
      expect(mockGetChatHistory).toHaveBeenCalledTimes(1);

      // AND the response to be processed without skipUserMessage
      expect(mockProcessChatHistoryResponse).toHaveBeenCalledTimes(1);
      expect(mockProcessChatHistoryResponse).toHaveBeenCalledWith(mockHistoryResponse, {
        skipUserMessage: undefined,
        sessionId: mockSessionId,
      });
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should return early when sessionId is null", async () => {
      // GIVEN the hook with null sessionId
      const { result } = renderHook(() =>
        useCvBulletsHandler({
          sessionId: null,
          addMessageToChat: mockAddMessageToChat,
          setAiIsTyping: mockSetAiIsTyping,
          processChatHistoryResponse: mockProcessChatHistoryResponse,
        })
      );

      // WHEN handling bullets sent
      await act(async () => {
        await result.current.handleBulletsSent("message");
      });

      // THEN expect no operations to be performed
      expect(mockAddMessageToChat).not.toHaveBeenCalled();
      expect(mockGetChatHistory).not.toHaveBeenCalled();
      expect(mockProcessChatHistoryResponse).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle errors gracefully", async () => {
      // GIVEN a bullets message and a network error
      const bulletsMessage = formatCvExperienceBulletsMessage(["Worked as a software engineer"]);
      const error = new Error("Network error");
      mockGetChatHistory.mockRejectedValue(error);

      const { result } = renderHook(() =>
        useCvBulletsHandler({
          sessionId: mockSessionId,
          addMessageToChat: mockAddMessageToChat,
          setAiIsTyping: mockSetAiIsTyping,
          processChatHistoryResponse: mockProcessChatHistoryResponse,
        })
      );

      // WHEN handling bullets sent
      await act(async () => {
        await result.current.handleBulletsSent(bulletsMessage);
      });

      // THEN expect the message to still be added optimistically
      expect(mockAddMessageToChat).toHaveBeenCalledTimes(1);

      // AND the response not to be processed
      expect(mockProcessChatHistoryResponse).not.toHaveBeenCalled();
      // AND errors should be logged
      expect(console.error).toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
