import React, { useEffect, useMemo } from "react";

import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "../../errors";
import UserPreferencesStateService from "../../../../userPreferences/UserPreferencesStateService";
import { useSnackbar } from "../../../../theme/SnackbarProvider/SnackbarProvider";

const DISPLAY_TIMEOUT = 5000;

const uniqueId = "1e13ec58-2931-47ef-b1a9-30550519707b";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PROMPT_CONTAINER: `skills-ranking-prompt-container-${uniqueId}`,
};

export const SKILLS_RANKING_PROMPT_MESSAGE_ID = `skills-ranking-prompt-message-${uniqueId}`;

export interface SkillsRankingPromptProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingPrompt: React.FC<Readonly<SkillsRankingPromptProps>> = ({
  onFinish,
  skillsRankingState,
}) => {

  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
  const { enqueueSnackbar } = useSnackbar();

  const airtime_amount = useMemo(() => (
    SkillsRankingService.getInstance().getConfig().config.airtimeBudget
  ), [])

  const handleUpdateState = async () => {
    if (skillsRankingState.phase === SkillsRankingPhase.INITIAL) {
      if (!activeSessionId) {
        throw new SkillsRankingError("Active session ID is not available.");
      }
      try {
        const newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          SkillsRankingPhase.BRIEFING
        );
        onFinish(newSkillsRankingState);
      } catch (error) {
        console.error("Error updating skills ranking state:", error);
        enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
          variant: "error",
        });
      }
    }
  }

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (skillsRankingState.phase === SkillsRankingPhase.INITIAL) {
      timeoutId = setTimeout(() => {
        handleUpdateState().then();
      }, DISPLAY_TIMEOUT);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [skillsRankingState.phase]);

  return (
    <MessageContainer origin={ConversationMessageSender.COMPASS} data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_CONTAINER}>
      <ChatBubble message={`You are almost there! Remember that if you completely finish this conversation with me you will receive ${airtime_amount} Rand in airtime.`} sender={ConversationMessageSender.COMPASS}/>
    </MessageContainer>
  );
};

export default SkillsRankingPrompt;
