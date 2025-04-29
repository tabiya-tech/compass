import React, { useState } from 'react';
import { ExperimentGroup, SkillsRankingState } from "src/chat/chatMessage/skillsRanking/types";
import { IChatMessage } from "src/chat/Chat.types";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import SkillsRankingPrompt from "src/chat/chatMessage/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import SkillsRankingVote from "src/chat/chatMessage/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import SkillsRankingResult from "src/chat/chatMessage/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";

interface SkillsRankingChatMessageProps {
  group: ExperimentGroup;
  chatMessage: IChatMessage;
}

export const SkillsRankingChatMessage: React.FC<SkillsRankingChatMessageProps> = ({ group, chatMessage }) => {
  const [state, setState] = useState<SkillsRankingState>(SkillsRankingState.INITIAL);

  const handleStateChange = (newState: SkillsRankingState) => {
    // TODO: When the service is implemented, we need to call the service to update the skills ranking state
    setState(newState);
  };

  const renderContent = () => {
    switch (state) {
      case SkillsRankingState.INITIAL:
        return (
          <SkillsRankingPrompt 
            group={group} 
            onShowInfo={() => handleStateChange(SkillsRankingState.SELF_EVALUATING)} 
            onSkip={() => handleStateChange(SkillsRankingState.SKIPPED)} 
          />
        );
      case SkillsRankingState.SKIPPED:
        return null;
      case SkillsRankingState.SELF_EVALUATING:
        return (
          <SkillsRankingVote 
            group={group} 
            onRankSelect={(rank) => {
              // TODO: When the service is implemented, we need to call the service to save the rank
              handleStateChange(SkillsRankingState.EVALUATED);
            }} 
          />
        );
      case SkillsRankingState.EVALUATED:
        return <SkillsRankingResult group={group} />;
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