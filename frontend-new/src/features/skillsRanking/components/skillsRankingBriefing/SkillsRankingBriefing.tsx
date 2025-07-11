import React, { useMemo, useContext, useState } from "react";

import { Box, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import UserPreferencesStateService from "../../../../userPreferences/UserPreferencesStateService";
import { SkillsRankingError } from "../../errors";
import { useSnackbar } from "../../../../theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineContext } from "../../../../app/isOnlineProvider/IsOnlineProvider";

const uniqueId = "0e95404a-2044-4634-a6e8-29cc7b2d754e";

export const DATA_TEST_ID = {
  SKILLS_RANKING_BRIEFING_CONTAINER: `skills-ranking-briefing-container-${uniqueId}`,
  SKILLS_RANKING_BRIEFING_CONTINUE_BUTTON: `skills-ranking-briefing-continue-button-${uniqueId}`,
};

export const SKILLS_RANKING_BRIEFING_MESSAGE_ID = `skills-ranking-briefing-message-${uniqueId}`;

export interface SkillsRankingBriefingProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingBriefing: React.FC<Readonly<SkillsRankingBriefingProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const jobPlatformUrl = useMemo(() => (
    SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl
  ), [])
  const [submitted, setSubmitted] = useState(false);
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);

  console.log(JSON.stringify(skillsRankingState, null, 2), ": in brifing")

  const handleUpdateState = async () => {
    if (skillsRankingState.phase === SkillsRankingPhase.BRIEFING) {
      if (!activeSessionId) {
        throw new SkillsRankingError("Active session ID is not available.");
      }
      try {
        const newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          SkillsRankingPhase.EFFORT
        );
        onFinish(newSkillsRankingState);
      } catch (error) {
        console.error("Error updating skills ranking state:", error);
        enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
          variant: "error",
        });
      } finally {
        setSubmitted(true);
      }
    }
  }

  return (
    <MessageContainer origin={ConversationMessageSender.COMPASS} data-testid={DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTAINER}>
      <ChatBubble message={`I will now calculate how many percent of jobs advertised on ${jobPlatformUrl} you have the required & most relevant skills for, and how you compare to other job seekers. This will take some time -- if you are not interested you can click 'cancel' in the next message, while I calculate. When you are ready please click continue.`}
                  sender={ConversationMessageSender.COMPASS}>
        <Box display="flex" flexDirection={"row"} justifyContent="flex-end" padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          <PrimaryButton onClick={handleUpdateState} disabled={skillsRankingState.phase !== SkillsRankingPhase.BRIEFING || !isOnline || submitted}>
            Continue
          </PrimaryButton>
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingBriefing;
