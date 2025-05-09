// mute the console
import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";

import { render, screen, userEvent } from "src/_test_utilities/test-utils";
import SkillsRankingPrompt, {
  DATA_TEST_ID,
  PROMPT_TEXTS,
  SKILLS_RANKING_BUTTON_POSITION_EXPERIMENT,
} from "src/chat/chatMessage/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import { nanoid } from "nanoid";
import { ButtonPositionGroup, ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import MetricsService from "src/metrics/metricsService";
import { TabiyaUser } from "src/auth/auth.types";
import { EventType } from "src/metrics/types";
import { MetricsError } from "src/error/commonErrors";
import {
  SensitivePersonalDataRequirement,
  Language,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";

describe("SkillsRankingPrompt tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
          onView={jest.fn()}
          onSkip={jest.fn()}
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
      // AND expect the view comparison button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_VIEW_BUTTON)).toBeInTheDocument();
      // AND the skip comparison button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_SKIP_BUTTON)).toBeInTheDocument();
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
        <SkillsRankingPrompt group={group} onView={jest.fn()} onSkip={jest.fn()} chatMessage={givenChatMessage} />
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
    test("should call onView and send metrics when the view comparison button is clicked", async () => {
      // GIVEN there is an active session and user
      const givenSessionId = 123;
      jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValueOnce(givenSessionId);
      const givenUserId = "foo-id";
      jest
        .spyOn(AuthenticationStateService.getInstance(), "getUser")
        .mockReturnValueOnce({ id: givenUserId } as TabiyaUser);
      // AND the experiment group is set
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValueOnce({
        user_id: givenUserId,
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {
          [SKILLS_RANKING_BUTTON_POSITION_EXPERIMENT]: ButtonPositionGroup.INFO_BUTTON_FIRST,
        },
      });

      // AND the metrics service will successfully send the event
      jest.spyOn(MetricsService.getInstance(), "sendMetricsEvent").mockReturnValueOnce();

      // AND the component is rendered
      const onView = jest.fn();
      const onSkip = jest.fn();
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
          onView={onView}
          onSkip={onSkip}
          chatMessage={givenChatMessage}
        />
      );
      render(givenComponent);

      // WHEN the view comparison button is clicked
      const viewButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_VIEW_BUTTON);
      await userEvent.click(viewButton);

      // THEN expect the onView function to have been called
      expect(onView).toHaveBeenCalled();
      // AND expect metrics to have been sent
      expect(MetricsService.getInstance().sendMetricsEvent).toHaveBeenCalledWith({
        event_type: EventType.UI_INTERACTION,
        user_id: givenUserId,
        session_id: givenSessionId,
        experiment_id: SKILLS_RANKING_BUTTON_POSITION_EXPERIMENT,
        experiment_group: ButtonPositionGroup.INFO_BUTTON_FIRST,
        clicked_component_ids: ["skills_ranking_VIEW_button"],
        timestamp: expect.any(String),
      });
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should call onSkip and send metrics when the skip comparison button is clicked", async () => {
      // GIVEN there is an active session and user
      const givenSessionId = 123;
      jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValueOnce(givenSessionId);
      const givenUserId = "foo-id";
      jest
        .spyOn(AuthenticationStateService.getInstance(), "getUser")
        .mockReturnValueOnce({ id: givenUserId } as TabiyaUser);
      // AND the experiment group is set
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValueOnce({
        user_id: givenUserId,
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {
          [SKILLS_RANKING_BUTTON_POSITION_EXPERIMENT]: ButtonPositionGroup.CONTINUE_BUTTON_FIRST,
        },
      });

      // AND the metrics service will successfully send the event
      jest.spyOn(MetricsService.getInstance(), "sendMetricsEvent").mockReturnValueOnce();

      // AND the component is rendered
      const onView = jest.fn();
      const onSkip = jest.fn();
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
          onView={onView}
          onSkip={onSkip}
          chatMessage={givenChatMessage}
        />
      );
      render(givenComponent);

      // WHEN the skip comparison button is clicked
      const skipButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_SKIP_BUTTON);
      await userEvent.click(skipButton);

      // THEN expect the onSkip function to have been called
      expect(onSkip).toHaveBeenCalled();
      // AND expect metrics to have been sent
      expect(MetricsService.getInstance().sendMetricsEvent).toHaveBeenCalledWith({
        event_type: EventType.UI_INTERACTION,
        user_id: givenUserId,
        session_id: givenSessionId,
        experiment_id: SKILLS_RANKING_BUTTON_POSITION_EXPERIMENT,
        experiment_group: ButtonPositionGroup.CONTINUE_BUTTON_FIRST,
        clicked_component_ids: ["skills_ranking_SKIP_button"],
        timestamp: expect.any(String),
      });
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should not send metrics when there is no active session or user", async () => {
      // GIVEN there is no active session or user
      jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValueOnce(null);
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValueOnce(null);
      // spy on the metrics service
      jest.spyOn(MetricsService.getInstance(), "sendMetricsEvent");
      // AND the component is rendered
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
          onView={jest.fn()}
          onSkip={jest.fn()}
          chatMessage={givenChatMessage}
        />
      );
      render(givenComponent);

      // WHEN the view comparison button is clicked
      const viewButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_VIEW_BUTTON);
      await userEvent.click(viewButton);

      // THEN expect metrics to not have been sent
      expect(MetricsService.getInstance().sendMetricsEvent).not.toHaveBeenCalled();
      // AND error to be logged
      expect(console.error).toHaveBeenCalledWith(
        new MetricsError(
          `Failed to send metrics event for SkillsRankingPrompt button metrics: User ID: undefined, Session ID: null, Experiment Group: undefined`
        )
      );
    });
  });
});
