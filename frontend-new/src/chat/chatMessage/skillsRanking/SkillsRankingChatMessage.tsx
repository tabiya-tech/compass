import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ExperimentGroup,
  SkillsRankingState,
  SkillsRankingStateResponse,
  RankValue,
} from "src/chat/chatMessage/skillsRanking/types";
import { SkillsRankingError } from "src/error/commonErrors";
import { 
  IChatMessage, 
  ChatMessageType,
  ISkillsRankingPromptMessage,
  ISkillsRankingVoteMessage,
  ISkillsRankingResultMessage
} from "src/chat/Chat.types";
import { SkillsRankingService } from "src/chat/chatMessage/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useChatContext } from "src/chat/ChatContext";
import { generateConversationConclusionMessage, generateTypingMessage } from "src/chat/util";

interface SkillsRankingChatMessageProps {
  chatMessage: IChatMessage;
}

export const SkillsRankingChatMessage: React.FC<SkillsRankingChatMessageProps> = ({ chatMessage }) => {
  const [state, setState] = useState<SkillsRankingStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [experimentGroup, setExperimentGroup] = useState<ExperimentGroup>(ExperimentGroup.GROUP_A);
  const { removeMessage, addMessage, messages } = useChatContext();
  const isInitialMount = useRef(true);

  // Helper function to check if a message type exists in the chat history
  const hasMessageOfType = useCallback((type: ChatMessageType) => {
    return messages.some(msg => msg.type === type);
  }, [messages]);

  useEffect(() => {
    const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();
    const group = userPreferences?.experiments?.SKILLS_RANKING_EXPERIMENT as ExperimentGroup || ExperimentGroup.GROUP_A;
    setExperimentGroup(group);
  }, []);

  const handleStateChange = useCallback(async (newState: SkillsRankingState, rank?: RankValue) => {
    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (sessionId === null) {
        throw new Error("No active session found");
      }

      const skillsRankingService = SkillsRankingService.getInstance();
      const response = await skillsRankingService.updateSkillsRankingState(sessionId, newState, rank ?? null);
      setError(null);

      // If this was a skip, remove all skills ranking messages and add conclusion
      if (newState === SkillsRankingState.SKIPPED) {
        // Remove all skills ranking related messages
        messages
          .filter(msg => [
            ChatMessageType.SKILLS_RANKING_PROMPT,
            ChatMessageType.SKILLS_RANKING_VOTE,
            ChatMessageType.SKILLS_RANKING_RESULT
          ].includes(msg.type as ChatMessageType))
          .forEach(msg => removeMessage(msg.message_id));

        const conclusionMessage = generateConversationConclusionMessage(
          `conclusion-${Date.now()}`,
          "Thank you for sharing your experiences with me. I hope I was able to help you reflect on your work journey.",
          new Date().toISOString()
        );
        addMessage(conclusionMessage);
        return;
      }

      // If moving to self-evaluating state and no vote message exists
      if (newState === SkillsRankingState.SELF_EVALUATING && !hasMessageOfType(ChatMessageType.SKILLS_RANKING_VOTE)) {
        const typingMessage = generateTypingMessage();
        addMessage(typingMessage);
        
        const timeoutId = setTimeout(() => {
          removeMessage(typingMessage.message_id);
          const voteMessage: ISkillsRankingVoteMessage = {
            ...chatMessage,
            message_id: `skills-ranking-vote-${Date.now()}`,
            type: ChatMessageType.SKILLS_RANKING_VOTE,
            message: "Please rate your skills",
            experimentGroup: experimentGroup,
            onRankSelect: (newRank: RankValue) => handleStateChange(SkillsRankingState.EVALUATED, newRank),
            error: null,
          };
          addMessage(voteMessage);
        }, Math.random() * 2000 + 3000);

        return () => clearTimeout(timeoutId);
      }

      // If moving to evaluated state and no result message exists
      if (newState === SkillsRankingState.EVALUATED && !hasMessageOfType(ChatMessageType.SKILLS_RANKING_RESULT)) {
        const typingMessage = generateTypingMessage();
        addMessage(typingMessage);
        
        const timeoutId = setTimeout(() => {
          removeMessage(typingMessage.message_id);
          const resultMessage: ISkillsRankingResultMessage = {
            ...chatMessage,
            message_id: `skills-ranking-result-${Date.now()}`,
            type: ChatMessageType.SKILLS_RANKING_RESULT,
            message: "Here's what we found",
            experimentGroup: experimentGroup,
            rank: response.ranking,
            error: null,
          };
          addMessage(resultMessage);

          // Add conclusion after a delay if it doesn't exist
          if (!hasMessageOfType(ChatMessageType.CONVERSATION_CONCLUSION)) {
            const conclusionTimeoutId = setTimeout(() => {
              const typingMessage = generateTypingMessage();
              addMessage(typingMessage);
              
              const finalTimeoutId = setTimeout(() => {
                removeMessage(typingMessage.message_id);
                const conclusionMessage = generateConversationConclusionMessage(
                  `conclusion-${Date.now()}`,
                  "Thank you for sharing your experiences with me. I hope I was able to help you reflect on your work journey.",
                  new Date().toISOString()
                );
                addMessage(conclusionMessage);
              }, Math.random() * 2000 + 3000);

              return () => clearTimeout(finalTimeoutId);
            }, 1000);

            return () => clearTimeout(conclusionTimeoutId);
          }
        }, Math.random() * 2000 + 3000);

        return () => clearTimeout(timeoutId);
      }

      setState(response);
    } catch (error) {
      console.error(new SkillsRankingError("Failed to update skills ranking state", error));
      setError("Failed to update skills ranking. Please try again.");
    }
  }, [chatMessage, experimentGroup, addMessage, removeMessage, messages, hasMessageOfType]);

  useEffect(() => {
    const fetchState = async () => {
      if (!isInitialMount.current) return;
      isInitialMount.current = false;
      
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

        // If we're in the initial state and no prompt exists yet
        if (response.current_state === SkillsRankingState.INITIAL && !hasMessageOfType(ChatMessageType.SKILLS_RANKING_PROMPT)) {
          const promptMessage: ISkillsRankingPromptMessage = {
            ...chatMessage,
            message_id: `skills-ranking-prompt-${Date.now()}`,
            type: ChatMessageType.SKILLS_RANKING_PROMPT,
            message: "Would you like to share information about your skills?",
            experimentGroup: experimentGroup,
            onShowInfo: () => handleStateChange(SkillsRankingState.SELF_EVALUATING),
            onContinue: () => handleStateChange(SkillsRankingState.SKIPPED),
          };
          addMessage(promptMessage);
        }
      } catch (error) {
        console.error(new SkillsRankingError("Failed to fetch skills ranking state", error));
        setError("Failed to load skills ranking. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchState();
  }, [experimentGroup, addMessage, chatMessage, handleStateChange, hasMessageOfType]);

  // If all states are SKIPPED, don't render anything
  if (state?.current_state === SkillsRankingState.SKIPPED) {
    return null;
  }

  // The main component now only manages state and doesn't render any UI
  return null;
};

export default SkillsRankingChatMessage;



