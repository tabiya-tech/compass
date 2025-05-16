import React, { useEffect } from "react";
import {
  SkillsRankingPhase,
  SkillsRankingState,
  CompareAgainstGroup,
  ButtonOrderGroup,
} from "src/features/skillsRanking/types";
import { Box, Typography, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

const uniqueId = "1e13ec58-2931-47ef-b1a9-30550519707b";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PROMPT_CONTAINER: `skills-ranking-prompt-container-${uniqueId}`,
  SKILLS_RANKING_PROMPT_TEXT: `skills-ranking-prompt-text-${uniqueId}`,
  SKILLS_RANKING_PROMPT_VIEW_BUTTON: `skills-ranking-prompt-view-button-${uniqueId}`,
  SKILLS_RANKING_PROMPT_SKIP_BUTTON: `skills-ranking-prompt-skip-button-${uniqueId}`,
};

export const SKILLS_RANKING_PROMPT_MESSAGE_TYPE = `skills-ranking-prompt-message-${uniqueId}`;

export interface SkillsRankingPromptProps {
  message: string,
  onView: () => Promise<void>;
  onSkip: () => Promise<void>;
  disabled?: boolean;
  skillsRankingState: SkillsRankingState;
}

enum SkillsRankingPromptAction {
  VIEW = "VIEW",
  SKIP = "SKIP",
}

export const PROMPT_TEXTS = {
  [CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS]:
    "Based on the skills we have found, I can tell you how your skill-set compares to other jobseekers. If you want to learn how competitive your skill-set is compared to other job seekers similar to you, you click the button below. Otherwise, you can choose to skip without viewing the comparison.",
  [CompareAgainstGroup.AGAINST_JOB_MARKET]:
    "Based on the skills we have found, I can tell you how your skill-set compares to the skills demanded by jobs on the SAYouth.mobi platform. If you want to learn how competitive your skill-set is compared to available jobs, you click the button below. Otherwise, you can choose to skip without viewing the comparison.",
};

const SkillsRankingPrompt: React.FC<Readonly<SkillsRankingPromptProps>> = ({
  message,
  onView,
  onSkip,
  disabled = false,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const [selectionMade, setSelectionMade] = React.useState<SkillsRankingPromptAction | undefined>(undefined);
  const [promptText, setPromptText] = React.useState<string>("");
  const [buttonPosition, setButtonPosition] = React.useState<ButtonOrderGroup | undefined>(undefined);

  useEffect(() => {
      setPromptText(PROMPT_TEXTS[skillsRankingState.experiment_groups.compare_against as keyof typeof PROMPT_TEXTS]);
      setButtonPosition(skillsRankingState.experiment_groups.button_order);
      if (skillsRankingState.phase === SkillsRankingPhase.INITIAL) {
        setSelectionMade(undefined);
      } else if (skillsRankingState.phase === SkillsRankingPhase.SKIPPED) {
        setSelectionMade(SkillsRankingPromptAction.SKIP);
      } else {
        setSelectionMade(SkillsRankingPromptAction.VIEW);
      }
  }, [skillsRankingState.phase, skillsRankingState.experiment_groups]);


  const isDisabled = disabled || skillsRankingState.phase !== SkillsRankingPhase.INITIAL || selectionMade !== undefined;

  const handleButtonClick = (action: SkillsRankingPromptAction) => {
    if (isDisabled) return;
    setSelectionMade(action);

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
      style={{ fontSize: theme.typography.body2.fontSize, backgroundColor: selectionMade === SkillsRankingPromptAction.SKIP ? theme.palette.primary.dark : undefined }}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_SKIP_BUTTON}
      disabled={isDisabled}
      disableWhenOffline
    >
      Skip comparison
    </PrimaryButton>,
    <PrimaryButton
      key="view"
      onClick={() => handleButtonClick(SkillsRankingPromptAction.VIEW)}
      style={{ fontSize: theme.typography.body2.fontSize, backgroundColor: selectionMade === SkillsRankingPromptAction.VIEW ? theme.palette.primary.dark : undefined }}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_VIEW_BUTTON}
      disabled={isDisabled}
      disableWhenOffline
    >
      View comparison
    </PrimaryButton>,
  ];

  return (
    <MessageContainer origin={ConversationMessageSender.COMPASS} data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_CONTAINER}>
      <ChatBubble message={message} sender={ConversationMessageSender.COMPASS}>
        <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          <Typography variant="body1" data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_TEXT}>
            {promptText}
          </Typography>
          <Box display="flex" justifyContent="flex-end" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
            {buttonPosition === ButtonOrderGroup.VIEW_BUTTON_FIRST ? [...buttons].reverse(): buttons}
          </Box>
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingPrompt;
