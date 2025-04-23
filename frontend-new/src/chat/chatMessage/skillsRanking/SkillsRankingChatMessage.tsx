import React, { useEffect, useState } from "react";
import { ExperimentGroup, SkillsRankingState } from "src/chat/chatMessage/skillsRanking/types";
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
  const [states, setStates] = useState<SkillsRankingState[]>([SkillsRankingState.INITIAL]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchState = async () => {
      setIsLoading(true);
      try {
        const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
        if (sessionId === null) return;

        const skillsRankingService = SkillsRankingService.getInstance();
        const response = await skillsRankingService.getSkillsRankingState(sessionId);
        setStates([response.current_state]);
      } catch (error) {
        console.error("Failed to fetch skills ranking state", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchState();
  }, []);

  const handleStateChange = async (newState: SkillsRankingState, stepIndex: number) => {
    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (sessionId === null) return;

      // Mark the current step as completed
      setCompletedSteps((prev) => new Set([...prev, stepIndex]));

      const skillsRankingService = SkillsRankingService.getInstance();
      await skillsRankingService.updateSkillsRankingState(sessionId, newState, "");

      setIsTyping(true);

      // Add a new state after delay
      const delay = Math.random() * 2000 + 3000;
      setTimeout(() => {
        setStates((prevStates) => [...prevStates, newState]);
        setIsTyping(false);
      }, delay);
    } catch (error) {
      console.error("Failed to update skills ranking state", error);
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

    const content = states.map((state, index) => {
      const isStepCompleted = completedSteps.has(index);
      const stepKey = getStepKey(state, index);

      switch (state) {
        case SkillsRankingState.INITIAL:
          return (
            <Box key={stepKey}>
              <SkillsRankingPrompt
                group={group}
                chatMessage={chatMessage}
                onShowInfo={() => handleStateChange(SkillsRankingState.SELF_EVALUATING, index)}
                onContinue={() => handleStateChange(SkillsRankingState.SKIPPED, index)}
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
                onRankSelect={async (rank) => {
                  const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
                  if (sessionId === null) return;

                  const skillsRankingService = SkillsRankingService.getInstance();
                  await skillsRankingService.updateSkillsRankingState(sessionId, SkillsRankingState.EVALUATED, rank);
                  handleStateChange(SkillsRankingState.EVALUATED, index);
                }}
                disabled={isTyping || isStepCompleted}
              />
            </Box>
          );
        case SkillsRankingState.EVALUATED:
          return (
            <Box key={stepKey}>
              <SkillsRankingResult group={group} chatMessage={chatMessage} />
            </Box>
          );
        default:
          return null;
      }
    });

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
        }}
      >
        {content}
        {isTyping && <TypingChatMessage />}
      </Box>
    );
  };

  // If all states are SKIPPED, don't render anything
  if (states.every((state) => state === SkillsRankingState.SKIPPED)) {
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
    </Box>
  );
};

export default SkillsRankingChatMessage;
