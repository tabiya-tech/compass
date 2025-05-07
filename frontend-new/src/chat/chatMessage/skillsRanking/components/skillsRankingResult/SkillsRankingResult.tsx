import React from "react";
import { ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { Box, CircularProgress, Typography } from "@mui/material";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ISkillsRankingResultMessage } from "src/chat/Chat.types";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";

const uniqueId = "3fb55364-3b63-48db-b1ef-818a4daa5862";

export const DATA_TEST_ID = {
  SKILLS_RANKING_RESULT_CONTAINER: `skills-ranking-result-container-${uniqueId}`,
  SKILLS_RANKING_RESULT_TEXT: `skills-ranking-result-text-${uniqueId}`,
  SKILLS_RANKING_RESULT_LOADING: `skills-ranking-result-loading-${uniqueId}`,
  SKILLS_RANKING_RESULT_ERROR: `skills-ranking-result-error-${uniqueId}`,
};

export interface SkillsRankingResultProps {
  chatMessage: ISkillsRankingResultMessage;
  group: ExperimentGroup;
  rank: string;
  isLoading?: boolean;
  error: string | null;
}

export const RESULT_MESSAGES = {
  [ExperimentGroup.GROUP_A]: (rank: string) => (
    <>
      Based on how important your skills are for a variety of occupations you currently rank <b>{rank}</b>. Do note that
      this can always change as you continue learning!
    </>
  ),
  [ExperimentGroup.GROUP_B]: (rank: string) => (
    <>
      Based on how important your skills are for a variety of jobs you currently rank <b>{rank}</b>. Do note that this
      can always change as you continue learning!
    </>
  ),
};

const SkillsRankingResult: React.FC<SkillsRankingResultProps> = ({ 
  chatMessage,
  group, 
  rank,
  isLoading = false,
  error 
}) => {
  const renderContent = () => {
    if (isLoading) {
      return (
        <Box display="flex" justifyContent="center" data-testid={DATA_TEST_ID.SKILLS_RANKING_RESULT_LOADING}>
          <CircularProgress size={24} />
        </Box>
      );
    }

    if (chatMessage.error) {
      return (
        <Typography 
          color="error" 
          variant="body2" 
          data-testid={DATA_TEST_ID.SKILLS_RANKING_RESULT_ERROR}
        >
          {chatMessage.error}
        </Typography>
      );
    }

    return (
      <Typography variant="body1" data-testid={DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT}>
        {RESULT_MESSAGES[group](chatMessage.rank)}
      </Typography>
    );
  };

  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.SKILLS_RANKING_RESULT_CONTAINER}>
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender}>
        {renderContent()}
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingResult;
