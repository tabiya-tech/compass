import "src/_test_utilities/consoleMock";
import { nanoid } from "nanoid";
import { ChatMessageType } from "src/chat/Chat.types";
import { ConversationMessageSender } from "./ChatService/ChatService.types";
import {
  FIXED_MESSAGES_TEXT,
  generateCompassMessage,
  generatePleaseRepeatMessage,
  generateSomethingWentWrongMessage,
  generateTypingMessage,
  generateUserMessage,
} from "./util";
import { ReactionKind } from "./reaction/reaction.types";

// Mock nanoid to return a fixed value for testing
jest.mock("nanoid", () => ({
  nanoid: jest.fn().mockReturnValue("foo-nanoid"),
}));

describe("Chat Utils", () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateUserMessage", () => {
    test("should generate a user message with the correct structure given no message_id", () => {
      // GIVEN a message string
      const givenMessage = "foo";
      // AND a sent at
      const givenSentAt = new Date().toISOString();
      // AND nanoid returns a specific value
      (nanoid as jest.Mock).mockReturnValue("foo-nanoid");

      // WHEN generating a user message
      const result = generateUserMessage(givenMessage, givenSentAt);

      // THEN expect the message to have the correct structure
      expect(result).toEqual({
        message_id: "foo-nanoid",
        sender: ConversationMessageSender.USER,
        message: givenMessage,
        sent_at: expect.any(String),
        type: ChatMessageType.BASIC_CHAT,
        reaction: null,
      });
      // AND expect nanoid to have been called
      expect(nanoid).toHaveBeenCalled();
      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should use provided message_id if one is passed", () => {
      // GIVEN a message string
      const givenMessage = "foo";
      // AND a sent at
      const givenSentAt = new Date().toISOString();
      // AND a specific message ID
      const givenMessageId = "specific-id";

      // WHEN generating a user message with a specific ID
      const result = generateUserMessage(givenMessage, givenSentAt, givenMessageId);

      // THEN expect the message to have the correct structure
      expect(result).toEqual({
        message_id: givenMessageId,
        sender: ConversationMessageSender.USER,
        message: givenMessage,
        sent_at: expect.any(String),
        type: ChatMessageType.BASIC_CHAT,
        reaction: null,
      });
      // AND expect nanoid to have not been called
      expect(nanoid).not.toHaveBeenCalled();
      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("generateCompassMessage", () => {
    test("should generate a compass message with the correct structure", () => {
      // GIVEN a message string
      const givenMessage = "foo";
      // AND a specific message ID
      const givenMessageId = "specific-id";
      // AND a timestamp
      const givenSentAt = "2024-03-20T12:00:00Z";
      // AND a reaction
      const givenReaction = {
        id: "foo-reaction-id",
        kind: ReactionKind.LIKED,
      };
      // WHEN generating a compass message
      const result = generateCompassMessage(givenMessageId, givenMessage, givenSentAt, givenReaction);

      // THEN expect the message to have the correct structure
      expect(result).toEqual({
        message_id: givenMessageId,
        sender: ConversationMessageSender.COMPASS,
        message: givenMessage,
        sent_at: givenSentAt,
        type: ChatMessageType.BASIC_CHAT,
        reaction: givenReaction,
      });
      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle null reaction", () => {
      // GIVEN a message string
      const givenMessage = "foo";
      // AND a specific message ID
      const givenMessageId = "specific-id";
      // AND a timestamp
      const givenSentAt = "2024-03-20T12:00:00Z";
      // WHEN generating a compass message with null reaction
      const result = generateCompassMessage(givenMessageId, givenMessage, givenSentAt, null);

      // THEN expect the message to have the correct structure
      expect(result).toEqual({
        message_id: givenMessageId,
        sender: ConversationMessageSender.COMPASS,
        message: givenMessage,
        sent_at: givenSentAt,
        type: ChatMessageType.BASIC_CHAT,
        reaction: null,
      });
      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("generateTypingMessage", () => {
    test("should generate a typing message with the correct structure", () => {
      // GIVEN a nanoid returns a specific value
      (nanoid as jest.Mock).mockReturnValue("foo-nanoid");

      // WHEN generating a typing message
      const result = generateTypingMessage();

      // THEN expect the message to have the correct structure
      expect(result).toEqual({
        message_id: "foo-nanoid",
        sender: ConversationMessageSender.COMPASS,
        message: FIXED_MESSAGES_TEXT.AI_IS_TYPING,
        sent_at: expect.any(String),
        type: ChatMessageType.TYPING,
        reaction: null,
      });
      // AND expect nanoid to have been called
      expect(nanoid).toHaveBeenCalled();
      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("generateSomethingWentWrongMessage", () => {
    test("should generate an error message with the correct structure", () => {
      // GIVEN nanoid returns a specific value
      (nanoid as jest.Mock).mockReturnValue("foo-nanoid");

      // WHEN generating a something went wrong message
      const result = generateSomethingWentWrongMessage();

      // THEN expect the message to have the correct structure
      expect(result).toEqual({
        message_id: "foo-nanoid",
        sender: ConversationMessageSender.COMPASS,
        message: FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG,
        sent_at: expect.any(String),
        type: ChatMessageType.ERROR,
        reaction: null,
      });
      // AND expect nanoid to have been called
      expect(nanoid).toHaveBeenCalled();
      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("generatePleaseRepeatMessage", () => {
    test("should generate a please repeat message with the correct structure", () => {
      // GIVEN nanoid returns a specific value
      (nanoid as jest.Mock).mockReturnValue("foo-nanoid");

      // WHEN generating a please repeat message
      const result = generatePleaseRepeatMessage();

      // THEN expect the message to have the correct structure
      expect(result).toEqual({
        message_id: "foo-nanoid",
        sender: ConversationMessageSender.COMPASS,
        message: FIXED_MESSAGES_TEXT.PLEASE_REPEAT,
        sent_at: expect.any(String),
        type: ChatMessageType.ERROR,
        reaction: null,
      });
      // AND expect nanoid to have been called
      expect(nanoid).toHaveBeenCalled();
      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
