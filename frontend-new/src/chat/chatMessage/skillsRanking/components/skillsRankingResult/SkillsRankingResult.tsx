import React, { useEffect, useState } from "react";
import { ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { Typography } from "@mui/material";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { IChatMessage } from "src/chat/Chat.types";
import { SkillsRankingService } from "src/chat/chatMessage/skillsRanking/skillsRankingService/skillsRankingService";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

const uniqueId = "3fb55364-3b63-48db-b1ef-818a4daa5862";

export const DATA_TEST_ID = {
  SKILLS_RANKING_RESULT_CONTAINER: `skills-ranking-result-container-${uniqueId}`,
  SKILLS_RANKING_RESULT_TEXT: `skills-ranking-result-text-${uniqueId}`,
};

export interface SkillsRankingResultProps {
  group: ExperimentGroup;
  chatMessage: IChatMessage;
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

const SkillsRankingResult: React.FC<SkillsRankingResultProps> = ({ group, chatMessage }) => {
  const [rank, setRank] = useState<string>("");

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
        if (sessionId === null) return;
        const skillsRankingService = SkillsRankingService.getInstance();
        const ranking = await skillsRankingService.getSkillsRankingState(sessionId);
        setRank(ranking.ranking);
      } catch (error) {
        console.error("Failed to fetch ranking", error);
      }
    };

    fetchRanking();
  }, []);

  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.SKILLS_RANKING_RESULT_CONTAINER}>
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender}>
        <Typography variant="body1" data-testid={DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT}>
          {rank ? RESULT_MESSAGES[group](rank) : " "}
        </Typography>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingResult;
