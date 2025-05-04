import React, { useEffect, useState } from 'react';
import { ExperimentGroup, SkillsRankingState } from "src/chat/chatMessage/skillsRanking/types";
import { IChatMessage } from "src/chat/Chat.types";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import SkillsRankingPrompt from "src/chat/chatMessage/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import SkillsRankingVote from "src/chat/chatMessage/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import SkillsRankingResult from "src/chat/chatMessage/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { SkillsRankingService } from "src/chat/chatMessage/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

interface SkillsRankingChatMessageProps {
  group: ExperimentGroup;
  chatMessage: IChatMessage;
}

export const SkillsRankingChatMessage: React.FC<SkillsRankingChatMessageProps> = ({ group, chatMessage }) => {
  const [state, setState] = useState<SkillsRankingState>(SkillsRankingState.INITIAL);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchState = async () => {
      setIsLoading(true);
      try {
        const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
        if (sessionId === null) return;
        
        const skillsRankingService = SkillsRankingService.getInstance();
        const response = await skillsRankingService.getSkillsRankingState(sessionId);
        setState(response.current_state);
      } catch (error) {
        console.error("Failed to fetch skills ranking state", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchState();
  }, []);

  const handleStateChange = async (newState: SkillsRankingState) => {
    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (sessionId === null) return;

      const skillsRankingService = SkillsRankingService.getInstance();
      await skillsRankingService.updateSkillsRankingState(sessionId, newState, "");
      setState(newState);
    } catch (error) {
      console.error("Failed to update skills ranking state", error);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return null;
    }

    switch (state) {
      case SkillsRankingState.INITIAL:
        return (
          <SkillsRankingPrompt 
            group={group}
            chatMessage={chatMessage}
            onShowInfo={() => handleStateChange(SkillsRankingState.SELF_EVALUATING)} 
            onContinue={() => handleStateChange(SkillsRankingState.SKIPPED)}
          />
        );
      case SkillsRankingState.SKIPPED:
        return null;
      case SkillsRankingState.SELF_EVALUATING:
        return (
          <SkillsRankingVote 
            group={group}
            chatMessage={chatMessage}
            onRankSelect={async (rank) => {
              const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
              if (sessionId === null) return;

              const skillsRankingService = SkillsRankingService.getInstance();
              await skillsRankingService.updateSkillsRankingState(sessionId, SkillsRankingState.EVALUATED, rank);
              handleStateChange(SkillsRankingState.EVALUATED);
            }} 
          />
        );
      case SkillsRankingState.EVALUATED:
        return <SkillsRankingResult group={group} chatMessage={chatMessage} />;
      default:
        return null;
    }
  };

  // If the state is SKIPPED, don't render anything
  if (state === SkillsRankingState.SKIPPED) {
    return null;
  }

  return (
    <MessageContainer origin={chatMessage.sender}>
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender}>
        {renderContent()}
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingChatMessage; 