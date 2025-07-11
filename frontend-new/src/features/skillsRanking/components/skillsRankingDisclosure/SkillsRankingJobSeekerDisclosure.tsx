import React, { useEffect, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { jobSeekerComparisonLabels } from "src/features/skillsRanking/components/skillsRankingDisclosure/types";
import { SkillsRankingError } from "../../errors";
import { SkillsRankingService } from "../../skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "../../../../userPreferences/UserPreferencesStateService";
import { useSnackbar } from "../../../../theme/SnackbarProvider/SnackbarProvider";

const DISPLAY_TIMEOUT = 10000;

const uniqueId = "9b0dbc80-c786-4c24-ba9d-04b6946fa0b9";

export const DATA_TEST_ID = {
  SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_CONTAINER: `skills-ranking-job-seeker-disclosure-container-${uniqueId}`
};

export const SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_MESSAGE_ID = `skills-ranking-job-seeker-disclosure-message-${uniqueId}`;

export interface SkillsRankingJobSeekerDisclosureProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingJobSeekerDisclosure: React.FC<Readonly<SkillsRankingJobSeekerDisclosureProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const selectedLabel = skillsRankingState.score.comparison_label;
  const selectedIndex = jobSeekerComparisonLabels.findIndex(label => label === selectedLabel);

  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
  const { enqueueSnackbar } = useSnackbar();

  const handleContinue = async () => {
    if (skillsRankingState.phase === SkillsRankingPhase.DISCLOSURE) {
      if (!activeSessionId) {
        throw new SkillsRankingError("Active session ID is not available.");
      }
      try {
        const newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          SkillsRankingPhase.PERCEIVED_RANK
        );
        onFinish(newSkillsRankingState);
      } catch (error) {
        console.error("Error updating skills ranking state:", error);
        enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
          variant: "error",
        });
      }
    } else {
      console.error(new SkillsRankingError("SkillsRankingJobSeekerDisclosure: handleContinue called in non-DISCLOSURE phase."));
    }
  }

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (skillsRankingState.phase === SkillsRankingPhase.DISCLOSURE) {
      timeoutId = setTimeout(() => {
        handleContinue().then()
      }, DISPLAY_TIMEOUT);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [skillsRankingState.phase]);

  if (skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_2 || skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_3)
  {
    return null; // Skip this component for GROUP_2 and GROUP_3
  }

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_CONTAINER}
    >
      <ChatBubble
        sender={ConversationMessageSender.COMPASS}
        message={`Compared to job seekers similar to you, you are in the [${selectedLabel}] group out of five. This means that when we rank 100 people from lowest to highest, and create five equal size groups, the first group are the 20 people fitting most jobs, and the fifth group are the people fitting fewer jobs on the platform than the other 80.`}
      >
        <Box mt={theme.spacing(2)}>
          {/* Percentage markers */}
          <Box display="flex" justifyContent="space-between" mb={1}>
            {[0, 20, 40, 60, 80, 100].map(pct => (
              <Typography key={pct} variant="caption">{pct}%</Typography>
            ))}
          </Box>

          {/* Group boxes */}
          {/*TODO: use mui theme*/}
          <Box display="flex" border="2px solid black">
            {jobSeekerComparisonLabels.map((label, idx) => (
              <Box
                key={label}
                flex={1}
                p={2}
                borderRight={idx < 4 ? "2px solid black" : "none"}
                bgcolor={idx === selectedIndex ? "success.main" : "transparent"}
                color={idx === selectedIndex ? "white" : "black"}
                textAlign="center"
                fontWeight="bold"
              >
                {label}
              </Box>
            ))}
          </Box>
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingJobSeekerDisclosure;
