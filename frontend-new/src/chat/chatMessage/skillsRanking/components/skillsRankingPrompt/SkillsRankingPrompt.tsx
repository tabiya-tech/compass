import React from "react";
import { ButtonPositionGroup, ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { Box, Typography, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { IChatMessage } from "src/chat/Chat.types";
import { EventType } from "src/metrics/types";
import MetricsService from "src/metrics/metricsService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { MetricsError } from "src/error/commonErrors";

const uniqueId = "1e13ec58-2931-47ef-b1a9-30550519707b";
export const SKILLS_RANKING_BUTTON_POSITION_EXPERIMENT = "SKILLS_RANKING_BUTTON_POSITION_EXPERIMENT";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PROMPT_CONTAINER: `skills-ranking-prompt-container-${uniqueId}`,
  SKILLS_RANKING_PROMPT_TEXT: `skills-ranking-prompt-text-${uniqueId}`,
  SKILLS_RANKING_PROMPT_VIEW_BUTTON: `skills-ranking-prompt-view-button-${uniqueId}`,
  SKILLS_RANKING_PROMPT_SKIP_BUTTON: `skills-ranking-prompt-skip-button-${uniqueId}`,
};

interface SkillsRankingPromptProps {
  group: ExperimentGroup;
  onView: () => void;
  onSkip: () => void;
  chatMessage: IChatMessage;
  disabled?: boolean;
}

enum SkillsRankingPromptAction {
  VIEW = "VIEW",
  SKIP = "SKIP",
}

export const PROMPT_TEXTS = {
  [ExperimentGroup.GROUP_A]:
    "Based on the skills we have found, I can tell you how your skillset compares to other jobseekers. If you want to learn how competitive your skillset is compared to other job seekers similar to you, you click the button below. Otherwise, you can choose to skip without viewing the comparison.",
  [ExperimentGroup.GROUP_B]:
    "Based on the skills we have found, I can tell you how your skillset compares to the skills demanded by jobs on the SAYouth.mobi platform. If you want to learn how competitive your skillset is compared to available jobs, you click the button below. Otherwise, you can choose to skip without viewing the comparison.",
};

const SkillsRankingPrompt: React.FC<SkillsRankingPromptProps> = ({
  group,
  onView,
  onSkip,
  disabled = false,
  chatMessage,
}) => {
  const theme = useTheme();

  const promptText = PROMPT_TEXTS[group];

  const buttonPositionExperiment =
    UserPreferencesStateService.getInstance().getUserPreferences()?.experiments?.[
      SKILLS_RANKING_BUTTON_POSITION_EXPERIMENT
    ];
  const isInfoButtonFirst = buttonPositionExperiment === ButtonPositionGroup.INFO_BUTTON_FIRST;

  const handleButtonClick = (action: SkillsRankingPromptAction) => {
    const userId = AuthenticationStateService.getInstance().getUser()?.id;
    const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

    if (userId && activeSessionId && buttonPositionExperiment) {
      MetricsService.getInstance().sendMetricsEvent({
        event_type: EventType.UI_INTERACTION,
        user_id: userId,
        session_id: activeSessionId,
        experiment_id: SKILLS_RANKING_BUTTON_POSITION_EXPERIMENT,
        experiment_group: buttonPositionExperiment,
        clicked_component_ids: [`skills_ranking_${action}_button`],
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error(
        new MetricsError(
          `Failed to send metrics event for SkillsRankingPrompt button metrics: User ID: ${userId}, Session ID: ${activeSessionId}, Experiment Group: ${buttonPositionExperiment}`
        )
      );
    }

    if (action === SkillsRankingPromptAction.VIEW) {
      onView();
    } else {
      onSkip();
    }
  };

  const buttons = [
    <PrimaryButton
      key="skip"
      onClick={() => handleButtonClick(SkillsRankingPromptAction.SKIP)}
      style={{ fontSize: theme.typography.body2.fontSize }}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_SKIP_BUTTON}
      disabled={disabled}
      disableWhenOffline
    >
      Skip comparison
    </PrimaryButton>,
    <PrimaryButton
      key="view"
      onClick={() => handleButtonClick(SkillsRankingPromptAction.VIEW)}
      style={{ fontSize: theme.typography.body2.fontSize }}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_VIEW_BUTTON}
      disabled={disabled}
      disableWhenOffline
    >
      View comparison
    </PrimaryButton>,
  ];

  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_CONTAINER}>
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender}>
        <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          <Typography variant="body1" data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_TEXT}>
            {promptText}
          </Typography>
          <Box display="flex" justifyContent="flex-end" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
            {isInfoButtonFirst ? [...buttons].reverse() : buttons}
          </Box>
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingPrompt;
