import "src/_test_utilities/consoleMock";
import { nanoid } from "nanoid";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  applySkillsRankingChangeToPhase,
  FIXED_MESSAGES_TEXT,
  generateCompassMessage,
  generateCVTypingMessage,
  generatePleaseRepeatMessage,
  generateSomethingWentWrongMessage,
  generateTypingMessage,
  generateUserMessage,
  parseConversationPhase,
} from "src/chat/util";
import { ReactionKind } from "./reaction/reaction.types";
import { ConversationPhase } from "./chatProgressbar/types";
import { InvalidConversationPhasePercentage } from "./errors";
import { USER_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import { COMPASS_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { TYPING_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { ERROR_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/errorChatMessage/ErrorChatMessage";
import { CV_TYPING_CHAT_MESSAGE_TYPE } from "src/CV/CVTypingChatMessage/CVTypingChatMessage";

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
        type: USER_CHAT_MESSAGE_TYPE,
        payload: {
          message: givenMessage,
          sent_at: givenSentAt,
        },
        component: expect.any(Function),
      });

      // AND expect the component to be a function that returns a UserChatMessage
      expect(result.component).toEqual(expect.any(Function));
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
        type: USER_CHAT_MESSAGE_TYPE,
        payload: {
          message: givenMessage,
          sent_at: givenSentAt,
        },
        component: expect.any(Function),
      });
      // AND expect the component to be a function that returns a UserChatMessage
      expect(result.component).toEqual(expect.any(Function));
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
        type: COMPASS_CHAT_MESSAGE_TYPE,
        payload: {
          message_id: givenMessageId,
          message: givenMessage,
          sent_at: givenSentAt,
          reaction: givenReaction,
        },
        component: expect.any(Function),
      });
      // AND expect the component to be a function that returns a CompassChatMessage
      expect(result.component).toEqual(expect.any(Function));
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
        type: COMPASS_CHAT_MESSAGE_TYPE,
        payload: {
          message_id: givenMessageId,
          message: givenMessage,
          sent_at: givenSentAt,
          reaction: null,
        },
        component: expect.any(Function),
      });
      // AND expect the component to be a function that returns a CompassChatMessage
      expect(result.component).toEqual(expect.any(Function));
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
        type: TYPING_CHAT_MESSAGE_TYPE,
        payload: {
          waitBeforeThinking: undefined,
        },
        component: expect.any(Function),
      });
      // AND expect the component to be a function that returns a TypingChatMessage
      expect(result.component).toEqual(expect.any(Function));
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
        type: ERROR_CHAT_MESSAGE_TYPE,
        payload: {
          message: FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG,
        },
        component: expect.any(Function),
      });
      // AND expect the component to be a function that returns a ChatBubble
      expect(result.component).toEqual(expect.any(Function));
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
        type: ERROR_CHAT_MESSAGE_TYPE,
        payload: {
          message: FIXED_MESSAGES_TEXT.PLEASE_REPEAT,
        },
        component: expect.any(Function),
      });
      // AND expect the component to be a function that returns a ChatBubble
      expect(result.component).toEqual(expect.any(Function));
      // AND expect nanoid to have been called
      expect(nanoid).toHaveBeenCalled();
      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("parseConversationPhase", () => {
    test("should log an error if newPhase.percentage is greater than 100 and set it to 100", () => {
      // GIVEN the newPhase with percentage greater than 100
      const previousPhase = { phase: ConversationPhase.UNKNOWN, percentage: 50, current: null, total: null };
      const newPhase = { phase: ConversationPhase.UNKNOWN, percentage: 150, current: null, total: null };

      // WHEN parsing the conversation phase
      const result = parseConversationPhase(newPhase, previousPhase);

      // THEN expect the result to be the new phase with percentage set to 100
      expect(result).toEqual({
        phase: ConversationPhase.UNKNOWN,
        percentage: 100,
        current: null,
        total: null,
      });

      // AND console.error to have been called with the correct error message
      expect(console.error).toHaveBeenCalledWith(
        new InvalidConversationPhasePercentage(newPhase.percentage, "greater than 100"),
      );
    });

    test("should log an error if newPhase.percentage is less than previousPhase.percentage and set it to previousPhase.percentage", () => {
      // GIVEN the newPhase with percentage less than previousPhase.percentage
      const previousPhase = { phase: ConversationPhase.UNKNOWN, percentage: 50, current: null, total: null };
      const newPhase = { phase: ConversationPhase.UNKNOWN, percentage: 30, current: null, total: null };

      // WHEN parsing the conversation phase
      const result = parseConversationPhase(newPhase, previousPhase);

      // THEN expect the result to be the new phase with percentage set to previousPhase.percentage
      expect(result).toEqual({
        phase: ConversationPhase.UNKNOWN,
        percentage: newPhase.percentage,
        current: null,
        total: null,
      });

      // AND console.error to have been called with the correct error message
      expect(console.error).toHaveBeenCalledWith(
        new InvalidConversationPhasePercentage(newPhase.percentage, "less than previous percentage 50"),
      );
    });

    test("should log an error if newPhase.percentage is less than 0 and set it to 0", () => {
      // GIVEN the newPhase with percentage less than 0
      const previousPhase = { phase: ConversationPhase.UNKNOWN, percentage: 50, current: null, total: null };
      const newPhase = { phase: ConversationPhase.UNKNOWN, percentage: -10, current: null, total: null };

      // WHEN parsing the conversation phase
      const result = parseConversationPhase(newPhase, previousPhase);

      // THEN expect the result to be the new phase with percentage set to 0
      expect(result).toEqual({
        phase: ConversationPhase.UNKNOWN,
        percentage: 0,
        current: null,
        total: null,
      });

      // AND console.error to have been called with the correct error message
      expect(console.error).toHaveBeenCalledWith(
        new InvalidConversationPhasePercentage(newPhase.percentage, "less than 0"),
      );
    });

    test("should return the new phase if percentage is valid", () => {
      // GIVEN the newPhase with valid percentage
      const previousPhase = { phase: ConversationPhase.UNKNOWN, percentage: 50, current: null, total: null };
      const newPhase = { phase: ConversationPhase.UNKNOWN, percentage: 80, current: null, total: null };

      // WHEN parsing the conversation phase
      const result = parseConversationPhase(newPhase, previousPhase);

      // THEN expect the result to be the new phase
      expect(result).toEqual(newPhase);

      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("it should not fail if no previous phase is provided", () => {
      // GIVEN the newPhase with valid percentage
      const newPhase = { phase: ConversationPhase.UNKNOWN, percentage: 80, current: null, total: null };

      // WHEN parsing the conversation phase without previous phase
      const result = parseConversationPhase(newPhase);

      // THEN expect the result to be the new phase
      expect(result).toEqual(newPhase);

      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("applySkillsRankingChangeToPhase", () => {
    test("should set percentage to 100 when phase is ENDED and skills ranking is disabled", () => {
      // GIVEN ENDED phase with skills ranking disabled
      const givenPhase = ConversationPhase.ENDED;
      const givenPercentage = 100;
      const givenSkillsRankingEnabled = false;
      const givenSkillsRankingCompleted = false;

      // WHEN parsing with skills ranking disabled
      const result = applySkillsRankingChangeToPhase(givenPhase, givenPercentage, givenSkillsRankingEnabled, givenSkillsRankingCompleted);

      // THEN percentage forced to 100
      expect(result).toEqual(100);
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should set percentage to 100 when phase is ENDED and skills ranking already completed", () => {
      // GIVEN ENDED phase with skills ranking enabled and completed
      const givenPhase = ConversationPhase.ENDED;
      const givenPercentage = 100;
      const givenSkillsRankingEnabled = true;
      const givenSkillsRankingCompleted = true;

      // WHEN parsing with completed ranking
      const result = applySkillsRankingChangeToPhase(givenPhase, givenPercentage, givenSkillsRankingEnabled, givenSkillsRankingCompleted);

      // THEN percentage forced to 100
      expect(result).toEqual(100);
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should set percentage to 95 when phase is ENDED and skills ranking pending", () => {
      // GIVEN ENDED phase with skills ranking enabled but not completed
      const givenPhase = ConversationPhase.ENDED;
      const givenPercentage = 70;
      const givenSkillsRankingEnabled = true;
      const givenSkillsRankingCompleted = false;

      // WHEN parsing with pending ranking
      const result = applySkillsRankingChangeToPhase(givenPhase, givenPercentage, givenSkillsRankingEnabled, givenSkillsRankingCompleted);

      // THEN percentage forced to 95
      expect(result).toEqual(95);
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  test("should retain the percentage if the phase is not ENDED", () => {
    // GIVEN ENDED phase with skills ranking enabled but not completed
    const givenPhase = ConversationPhase.COLLECT_EXPERIENCES;
    const givenPercentage = 43;
    const givenSkillsRankingEnabled = true;
    const givenSkillsRankingCompleted = false;

    // WHEN parsing with pending ranking
    const result = applySkillsRankingChangeToPhase(givenPhase, givenPercentage, givenSkillsRankingEnabled, givenSkillsRankingCompleted);

    // THEN percentage forced to 95
    expect(result).toEqual(43);
    expect(console.error).not.toHaveBeenCalled();
  })

  describe("generateCVTypingMessage", () => {
    test("should generate a CV typing message with the correct structure when isUploaded is false", () => {
      // GIVEN a nanoid returns a specific value
      (nanoid as jest.Mock).mockReturnValue("foo-nanoid");
      const isUploaded = false;

      // WHEN generating a CV typing message
      const result = generateCVTypingMessage(isUploaded);

      // THEN expect the message to have the correct structure
      expect(result).toEqual({
        message_id: "foo-nanoid",
        sender: ConversationMessageSender.COMPASS,
        type: CV_TYPING_CHAT_MESSAGE_TYPE,
        payload: {
          isUploaded: isUploaded,
        },
        component: expect.any(Function),
      });
      // AND expect the component to be a function that returns a CVTypingChatMessage
      expect(result.component).toEqual(expect.any(Function));
      // AND expect nanoid to have been called
      expect(nanoid).toHaveBeenCalled();
      // AND expect no errors or warnings to have been logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
