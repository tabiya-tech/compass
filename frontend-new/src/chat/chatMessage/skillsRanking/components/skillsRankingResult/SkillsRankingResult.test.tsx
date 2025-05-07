// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import SkillsRankingResult, {
  DATA_TEST_ID,
} from "src/chat/chatMessage/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import { nanoid } from "nanoid";
import { ExperimentGroup, RankValue } from "src/chat/chatMessage/skillsRanking/types";
import { SkillsRankingService } from "src/chat/chatMessage/skillsRanking/skillsRankingService/skillsRankingService";
import { ChatMessageType, IChatMessage, ISkillsRankingResultMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

// Mock the skills ranking service
jest.mock("src/chat/chatMessage/skillsRanking/skillsRankingService/skillsRankingService", () => ({
  SkillsRankingService: {
    getInstance: jest.fn(() => ({
      getSkillsRankingState: jest.fn(() => ({
        session_id: 1234,
        experiment_group: "GROUP_A",
        current_state: "EVALUATED",
        ranking: "foobar",
        self_ranking: null,
      })),
    })),
  },
}));

describe("SkillsRankingResult tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValueOnce(1234);
  });

  describe("render tests", () => {
    test("should render component successfully", async () => {
      // GIVEN a chat message
      const givenChatMessage: ISkillsRankingResultMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING_RESULT,
        reaction: null,
        experimentGroup: ExperimentGroup.GROUP_A,
        rank: "10%",
        error: null,
      };

      // WHEN the component is rendered
      render(<SkillsRankingResult rank={"10%"} group={ExperimentGroup.GROUP_A} chatMessage={givenChatMessage} error={null} />);

      // THEN expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_CONTAINER);
      expect(container).toBeInTheDocument();
      // AND expect the message bubble to be visible
      expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
      // AND expect the text to be in the document
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT)).toBeInTheDocument();
      });
      // AND to match the snapshot
      expect(container).toMatchSnapshot();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      [ExperimentGroup.GROUP_A, "foobar"],
      [ExperimentGroup.GROUP_B, "foobar"],
    ])("should render correct result text for %s", async (group, rank) => {
      // GIVEN a chat message
      const givenChatMessage: ISkillsRankingResultMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING_RESULT,
        reaction: null,
        experimentGroup: group,
        rank: rank as RankValue,
        error: null,
      };

      // WHEN the component is rendered
      render(<SkillsRankingResult rank={rank} group={group} chatMessage={givenChatMessage} error={null} />);

      // THEN expect the result text to be in the document
      await waitFor(() => {
        const resultText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT);
        expect(resultText).toBeInTheDocument();
      });
      // AND expect the result text to contain the correct rank
      const resultText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT);
      expect(resultText.textContent).toContain(rank);
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle error when ranking service fails", async () => {
      // GIVEN a raking service that fails
      const mockError = new Error("Failed to fetch ranking");
      const mockGetSkillsRankingState = jest.fn().mockRejectedValueOnce(mockError);
      (SkillsRankingService.getInstance as jest.Mock).mockReturnValueOnce({
        getSkillsRankingState: mockGetSkillsRankingState,
      });
      // AND a chat message
      const givenChatMessage: ISkillsRankingResultMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING_RESULT,
        reaction: null,
        experimentGroup: ExperimentGroup.GROUP_A,
        rank: "10%",
        error: null,
      };

      // WHEN the component is rendered
      render(<SkillsRankingResult rank={"10%"} group={ExperimentGroup.GROUP_A} chatMessage={givenChatMessage} error={null} />);

      // THEN expect the error to be logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith("Failed to fetch ranking", mockError);
      });
      // AND expect the result text to be empty
      const resultText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT);
      expect(resultText.textContent).toBe(" ");
    });

    test("should successfully fetch and display ranking", async () => {
      // GIVEN a ranking service that returns a successful response
      const mockRanking = "85%";
      const givenSessionId = 1234;
      const mockGetSkillsRankingState = jest.fn().mockResolvedValueOnce({
        session_id: givenSessionId,
        experiment_group: "GROUP_A",
        current_state: "EVALUATED",
        ranking: mockRanking,
        self_ranking: null,
      });
      (SkillsRankingService.getInstance as jest.Mock).mockReturnValueOnce({
        getSkillsRankingState: mockGetSkillsRankingState,
      });
      // AND a chat message
      const givenChatMessage: ISkillsRankingResultMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING_RESULT,
        reaction: null,
        experimentGroup: ExperimentGroup.GROUP_A,
        rank: "10%",
        error: null,
      };

      // WHEN the component is rendered
      render(<SkillsRankingResult rank={"10%"} group={ExperimentGroup.GROUP_A} chatMessage={givenChatMessage} error={null} />);

      // THEN expect the ranking service to be called with the correct session ID
      expect(mockGetSkillsRankingState).toHaveBeenCalledWith(givenSessionId);
      // AND expect the result text to contain the ranking
      await waitFor(() => {
        const resultText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT);
        expect(resultText.textContent).toContain(mockRanking);
      });
      // AND expect no errors to be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("error tests", () => {
    test("should render error message when error prop is provided", () => {
      // GIVEN a chat message
      const givenErrorMessage = "An error occurred";
      const givenChatMessage: ISkillsRankingResultMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING_RESULT,
        reaction: null,
        experimentGroup: ExperimentGroup.GROUP_A,
        rank: "10%",
        error: givenErrorMessage,
      };
      // WHEN the component is rendered
      render(<SkillsRankingResult rank={"10%"} group={ExperimentGroup.GROUP_A} chatMessage={givenChatMessage} error={givenErrorMessage} />);

      // THEN expect the error message to be in the document
      expect(screen.getByText(givenErrorMessage)).toBeInTheDocument();
    });
  });
  
});
