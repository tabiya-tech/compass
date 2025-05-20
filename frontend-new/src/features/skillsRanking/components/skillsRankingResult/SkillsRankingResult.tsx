import React, { useEffect, useState } from "react";
import { 
  CompareAgainstGroup,
  SkillsRankingState 
} from "src/features/skillsRanking/types";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

const uniqueId = "3fb55364-3b63-48db-b1ef-818a4daa5862";

export const SKILLS_RANKING_RESULT_MESSAGE_TYPE = `skills-ranking-result-message-${uniqueId}`;

export const DATA_TEST_ID = {
  SKILLS_RANKING_RESULT_CONTAINER: `skills-ranking-result-container-${uniqueId}`,
  SKILLS_RANKING_RESULT_TEXT: `skills-ranking-result-text-${uniqueId}`,
  SKILLS_RANKING_LOADING_TEXT: `skills-ranking-loading-text-${uniqueId}`,
  SKILLS_RANKING_LOADING_INDICATOR: `skills-ranking-loading-indicator-${uniqueId}`,
  SKILLS_RANKING_ERROR: `skills-ranking-error-${uniqueId}`,
};

export interface SkillsRankingResultProps {
  message: string;
  skillsRankingState: SkillsRankingState;
  isLoading: boolean;
}

export const IMMEDIATE_RESULT_MESSAGES = {
  [CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS]: (rank: string) => (
    <>
      Based on how important your skills are versus other job seekers, you currently rank in the <b>{rank}</b> percentile. Do note that
      this can always change as you continue learning!
    </>
  ),
  [CompareAgainstGroup.AGAINST_JOB_MARKET]: (rank: string) => (
    <>
      Based on how important your skills are versus the job market, you currently rank in the <b>{rank}</b> percentile. Do note that this
      can always change as you continue learning!
    </>
  ),
};

export const DELAYED_RESULT_MESSAGE = "Your skills ranking is taking longer than expected to calculate. We will share the results with you via SMS within 24 hours."

const SkillsRankingResult: React.FC<Readonly<SkillsRankingResultProps>> = ({ 
  message, 
  skillsRankingState,
  isLoading
}) => {
  const theme = useTheme();
  const [compareAgainstGroup, setCompareAgainstGroup] = useState<CompareAgainstGroup | null>(null);
  const [delayedResults, setDelayedResults] = useState<boolean>(false);

  useEffect(() => {
    setCompareAgainstGroup(skillsRankingState.experiment_groups.compare_against);
    setDelayedResults(skillsRankingState.experiment_groups.delayed_results);
  }, [skillsRankingState.experiment_groups]);

  console.log('compareAgainstGroup:', compareAgainstGroup);
  console.log('delayedResults:', delayedResults);
  console.log('skillsRankingState:', skillsRankingState);

  return (
    <MessageContainer origin={ConversationMessageSender.COMPASS} data-testid={DATA_TEST_ID.SKILLS_RANKING_RESULT_CONTAINER}>
      <ChatBubble message={delayedResults ? DELAYED_RESULT_MESSAGE : message} sender={ConversationMessageSender.COMPASS}>
        <Box>
          {isLoading ? (
            <Box display="flex">
              <Typography
                variant="body1"
                alignItems="center"
                gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_LOADING_TEXT}
              >
                Please wait while I compare your skillset...
              </Typography>
              <CircularProgress
                size={16}
                aria-label="Analyzing skillset"
                sx={{ color: (theme) => theme.palette.info.contrastText }}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_LOADING_INDICATOR}
              />
            </Box>
          ) : (
            <Typography variant="body1" data-testid={DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT}>
              {(skillsRankingState.ranking && compareAgainstGroup && !delayedResults) ? IMMEDIATE_RESULT_MESSAGES[compareAgainstGroup](skillsRankingState.ranking) : ""}
            </Typography>
          )}
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingResult;
