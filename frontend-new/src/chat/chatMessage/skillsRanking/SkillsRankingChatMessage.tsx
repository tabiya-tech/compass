import React, { useEffect, useState } from "react";
import {
  ExperimentGroup,
  SkillsRankingState,
  SkillsRankingStateResponse,
  SkillsRankingError,
  RankValue,
} from "src/chat/chatMessage/skillsRanking/types";
import { IChatMessage } from "src/chat/Chat.types";
import SkillsRankingPrompt from "src/chat/chatMessage/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import SkillsRankingVote from "src/chat/chatMessage/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import SkillsRankingResult from "src/chat/chatMessage/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import { SkillsRankingService } from "src/chat/chatMessage/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { Box, useTheme } from "@mui/material";

interface SkillsRankingChatMessageProps {
  group: ExperimentGroup;
  chatMessage: IChatMessage;
}

export const SkillsRankingChatMessage: React.FC<SkillsRankingChatMessageProps> = ({ group, chatMessage }) => {
  const theme = useTheme();
  const [state, setState] = useState<SkillsRankingStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<SkillsRankingError | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

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
        console.error("Failed to fetch skills ranking state", error);
        setError({
          message: "Failed to load skills ranking. Please try again.",
          code: "FETCH_ERROR",
          timestamp: new Date().toISOString()
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchState();
  }, []);

  const handleStateChange = async (newState: SkillsRankingState, stepIndex: number, rank?: RankValue) => {
    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (sessionId === null) {
        throw new Error("No active session found");
      }

      // Mark the current step as completed
      setCompletedSteps((prev) => new Set([...prev, stepIndex]));

      const skillsRankingService = SkillsRankingService.getInstance();
      const response = await skillsRankingService.updateSkillsRankingState(sessionId, newState, rank ?? null);
      setState(response);
      setError(null);

      setIsTyping(true);

      // Add a new state after delay
      const delay = Math.random() * 2000 + 3000;
      setTimeout(() => {
        setIsTyping(false);
      }, delay);
    } catch (error) {
      console.error("Failed to update skills ranking state", error);
      setError({
        message: "Failed to update skills ranking. Please try again.",
        code: "UPDATE_ERROR",
        timestamp: new Date().toISOString()
      });
      setIsTyping(false);
    }
  };

  const getStepKey = (state: SkillsRankingState, index: number) => {
    return `${state.toLowerCase()}-step-${index}`;
  };

  const renderContent = () => {
    if (isLoading) {
      return null;
    }

    if (!state) {
      return null;
    }

    const isStepCompleted = completedSteps.has(0);
    const stepKey = getStepKey(state.current_state, 0);

    switch (state.current_state) {
      case SkillsRankingState.INITIAL:
        return (
          <Box key={stepKey}>
            <SkillsRankingPrompt
              group={group}
              chatMessage={chatMessage}
              onShowInfo={() => handleStateChange(SkillsRankingState.SELF_EVALUATING, 0)}
              onContinue={() => handleStateChange(SkillsRankingState.SKIPPED, 0)}
              disabled={isTyping || isStepCompleted}
            />
          </Box>
        );
      case SkillsRankingState.SKIPPED:
        return null;
      case SkillsRankingState.SELF_EVALUATING:
        return (
          <Box key={stepKey}>
            <SkillsRankingVote
              group={group}
              chatMessage={chatMessage}
              onRankSelect={(rank) => handleStateChange(SkillsRankingState.EVALUATED, 0, rank)}
              disabled={isTyping || isStepCompleted}
              error={error?.message}
            />
          </Box>
        );
      case SkillsRankingState.EVALUATED:
        return (
          <Box key={stepKey}>
            <SkillsRankingResult 
              group={group} 
              chatMessage={chatMessage} 
              rank={state.ranking}
              isLoading={isTyping}
              error={error?.message}
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
