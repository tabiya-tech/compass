import React from "react";
import { ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { Box, Typography, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { IChatMessage } from "src/chat/Chat.types";

const uniqueId = "1e13ec58-2931-47ef-b1a9-30550519707b";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PROMPT_CONTAINER: `skills-ranking-prompt-container-${uniqueId}`,
  SKILLS_RANKING_PROMPT_TEXT: `skills-ranking-prompt-text-${uniqueId}`,
  SKILLS_RANKING_PROMPT_BUTTON: `skills-ranking-prompt-button-${uniqueId}`,
  SKILLS_RANKING_PROMPT_SKIP_BUTTON: `skills-ranking-prompt-skip-button-${uniqueId}`,
};

interface SkillsRankingPromptProps {
  group: ExperimentGroup;
  onShowInfo: () => void;
  onSkip: () => void;
  chatMessage: IChatMessage;
  disabled?: boolean;
}

export const PROMPT_TEXTS = {
  [ExperimentGroup.GROUP_A]:
    'Based on the skills we have found, I can tell you how your skillset compares to other jobseekers. If you want to learn how competitive your skillset is compared to other job seekers similar to you, you click the button below. Otherwise, you can click "Skip" to continue without viewing the comparison.',
  [ExperimentGroup.GROUP_B]:
    'Based on the skills we have found, I can tell you how your skillset compares to the skills demanded by jobs on the SAYouth.mobi platform. If you want to learn how competitive your skillset is compared to available jobs, you click the button below. Otherwise, you can click "Skip" to continue without viewing the comparison.',
};

const SkillsRankingPrompt: React.FC<SkillsRankingPromptProps> = ({
  group,
  onShowInfo,
  onSkip,
  disabled = false,
  chatMessage,
}) => {
  const theme = useTheme();
  const promptText = PROMPT_TEXTS[group];

  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_CONTAINER}>
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender}>
        <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          <Typography variant="body1" data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_TEXT}>
            {promptText}
          </Typography>
          <Box display="flex" justifyContent="flex-end" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
            <PrimaryButton
              onClick={() => onSkip()}
              style={{ fontSize: theme.typography.body2.fontSize }}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_SKIP_BUTTON}
              disabled={disabled}
              disableWhenOffline
            >
              Continue without information
            </PrimaryButton>
            <PrimaryButton
              onClick={() => onShowInfo()}
              style={{ fontSize: theme.typography.body2.fontSize }}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_BUTTON}
              disabled={disabled}
              disableWhenOffline
            >
              Get information
            </PrimaryButton>
          </Box>
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingPrompt;
