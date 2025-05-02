// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingPrompt, {
  DATA_TEST_ID,
  PROMPT_TEXTS,
} from "src/chat/chatMessage/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import { nanoid } from "nanoid";
import { ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";

describe("SkillsRankingPrompt tests", () => {
  describe("render tests", () => {
    test("should render component successfully", () => {
      // GIVEN a chat message
      const givenChatMessage: IChatMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING,
        reaction: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingPrompt
          group={ExperimentGroup.GROUP_A}
          onShowInfo={jest.fn()}
          onContinue={jest.fn()}
          chatMessage={givenChatMessage}
        />
      );

      // THEN expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_CONTAINER);
      expect(container).toBeInTheDocument();
      // AND expect the message bubble to be visible
      expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
      // AND expect the text to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_TEXT)).toBeInTheDocument();
      // AND expect the get info button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_INFO_BUTTON)).toBeInTheDocument();
      // AND continue without an info button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_CONTINUE_BUTTON)).toBeInTheDocument();
      // AND to match the snapshot
      expect(container).toMatchSnapshot();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      [ExperimentGroup.GROUP_A, PROMPT_TEXTS[ExperimentGroup.GROUP_A]],
      [ExperimentGroup.GROUP_B, PROMPT_TEXTS[ExperimentGroup.GROUP_B]],
    ])("should render correct prompt text for %s", (group, expectedText) => {
      // GIVEN a chat message
      const givenChatMessage: IChatMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING,
        reaction: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingPrompt
          group={group}
          onShowInfo={jest.fn()}
          onContinue={jest.fn()}
          chatMessage={givenChatMessage}
        />
      );

      // THEN expect the correct prompt text to be in the document
      const promptText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_TEXT);
      expect(promptText).toBeInTheDocument();
      expect(promptText).toHaveTextContent(expectedText);
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("action tests", () => {
    test("should call onShowInfo when the info button is clicked", () => {
      // GIVEN a SkillsRankingPrompt component
      const onShowInfo = jest.fn();
      const onContinue = jest.fn();
      const givenChatMessage: IChatMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING,
        reaction: null,
      };
      const givenComponent = (
        <SkillsRankingPrompt
          group={ExperimentGroup.GROUP_A}
          onShowInfo={onShowInfo}
          onContinue={onContinue}
          chatMessage={givenChatMessage}
        />
      );

      // WHEN the component is rendered
      render(givenComponent);

      // AND the get info button is clicked
      const infoButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_INFO_BUTTON);
      infoButton.click();

      // THEN expect the onShowInfo function to have been called
      expect(onShowInfo).toHaveBeenCalled();
    });

    test("should call onContinue when the skip button is clicked", () => {
      // GIVEN a SkillsRankingPrompt component
      const onShowInfo = jest.fn();
      const onContinue = jest.fn();
      const givenChatMessage: IChatMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING,
        reaction: null,
      };
      const givenComponent = (
        <SkillsRankingPrompt
          group={ExperimentGroup.GROUP_A}
          onShowInfo={onShowInfo}
          onContinue={onContinue}
          chatMessage={givenChatMessage}
        />
      );

      // WHEN the component is rendered
      render(givenComponent);

      // AND continue without info button is clicked
      const continueButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_CONTINUE_BUTTON);
      continueButton.click();

      // THEN expect the onContinue function to have been called
      expect(onContinue).toHaveBeenCalled();
    });
  });
});
