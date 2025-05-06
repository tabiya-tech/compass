import React, { useEffect, useState } from "react";
import {
  ExperimentGroup,
  SkillsRankingState,
  SkillsRankingStateResponse,
  RankValue,
} from "src/chat/chatMessage/skillsRanking/types";
import { SkillsRankingError } from "src/error/commonErrors";
import { IChatMessage } from "src/chat/Chat.types";
import SkillsRankingPrompt from "src/chat/chatMessage/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import SkillsRankingVote from "src/chat/chatMessage/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import SkillsRankingResult from "src/chat/chatMessage/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import { SkillsRankingService } from "src/chat/chatMessage/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { Box } from "@mui/material";

interface SkillsRankingChatMessageProps {
  chatMessage: IChatMessage;
}

export const SkillsRankingChatMessage: React.FC<SkillsRankingChatMessageProps> = ({ chatMessage }) => {
  const [state, setState] = useState<SkillsRankingStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [experimentGroup, setExperimentGroup] = useState<ExperimentGroup>(ExperimentGroup.GROUP_A);

  useEffect(() => {
    const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();
    const group = userPreferences?.experiments?.SKILLS_RANKING_EXPERIMENT as ExperimentGroup || ExperimentGroup.GROUP_A;
    setExperimentGroup(group);
  }, []);

  useEffect(() => {
    const fetchState = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
        if (sessionId === null) {
          throw new Error("No active session found");
        }

        const skillsRankingService = SkillsRankingService.getInstance();
        const response = await skillsRankingService.getSkillsRankingState(sessionId);
        setState(response);
      } catch (error) {
        console.error(new SkillsRankingError("Failed to fetch skills ranking state", error));
        setError("Failed to load skills ranking. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchState();
  }, []);

  const handleStateChange = async (newState: SkillsRankingState, rank?: RankValue) => {
    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (sessionId === null) {
        throw new Error("No active session found");
      }

      const skillsRankingService = SkillsRankingService.getInstance();
      const response = await skillsRankingService.updateSkillsRankingState(sessionId, newState, rank ?? null);
      setError(null);

      setIsTyping(true);

      // Add a new state after delay
      const delay = Math.random() * 2000 + 3000;
      setTimeout(() => {
        setIsTyping(false);
        setState(response);
      }, delay);
    } catch (error) {
      console.error(new SkillsRankingError("Failed to update skills ranking state", error));
      setError("Failed to update skills ranking. Please try again.");
      setIsTyping(false);
    }
  };

  const renderContent = () => {
    if (isLoading || !state) {
      return null;
    }

    switch (state.current_state) {
      case SkillsRankingState.INITIAL:
        return (
          <Box>
            <SkillsRankingPrompt
              group={experimentGroup}
              chatMessage={chatMessage}
              onShowInfo={() => handleStateChange(SkillsRankingState.SELF_EVALUATING)}
              onContinue={() => handleStateChange(SkillsRankingState.SKIPPED)}
              disabled={isTyping}
            />
          </Box>
        );
      case SkillsRankingState.SKIPPED:
        return null;
      case SkillsRankingState.SELF_EVALUATING:
        return (
          <Box>
            <SkillsRankingVote
              group={experimentGroup}
              chatMessage={chatMessage}
              onRankSelect={(rank) => handleStateChange(SkillsRankingState.EVALUATED, rank)}
              disabled={isTyping}
              error={error}
            />
          </Box>
        );
      case SkillsRankingState.EVALUATED:
        return (
          <Box>
            <SkillsRankingResult 
              group={experimentGroup} 
              chatMessage={chatMessage} 
              rank={state.ranking}
              isLoading={isTyping}
              error={error}
            />
          </Box>
        );
      default:
        return null;
    }
  };

  // If all states are SKIPPED, don't render anything
  if (state?.current_state === SkillsRankingState.SKIPPED) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      {renderContent()}
      {isTyping && <TypingChatMessage />}
    </Box>
  );
};

export default SkillsRankingChatMessage;
