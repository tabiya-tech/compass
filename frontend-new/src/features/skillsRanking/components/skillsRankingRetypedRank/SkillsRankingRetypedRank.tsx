import React, { useState, useMemo, useContext, useEffect } from "react";
import { Box, Slider, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "../../errors";
import UserPreferencesStateService from "../../../../userPreferences/UserPreferencesStateService";
import { IsOnlineContext } from "../../../../app/isOnlineProvider/IsOnlineProvider";
import { useSnackbar } from "../../../../theme/SnackbarProvider/SnackbarProvider";

const uniqueId = "eb90de4c-2462-4b6d-8b9c-1b5c6ae64129";

export const DATA_TEST_ID = {
  SKILLS_RANKING_RETYPED_RANK_CONTAINER: `skills-ranking-retyped-rank-container-${uniqueId}`,
  SKILLS_RANKING_RETYPED_RANK_SLIDER: `skills-ranking-retyped-rank-slider-${uniqueId}`,
  SKILLS_RANKING_RETYPED_RANK_SUBMIT_BUTTON: `skills-ranking-retyped-rank-submit-button-${uniqueId}`,
};

export interface SkillsRankingRetypedRankProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

export const SKILLS_RANKING_RETYPED_RANK_MESSAGE_ID = `skills-ranking-retyped-rank-message-${uniqueId}`;

const SkillsRankingRetypedRank: React.FC<Readonly<SkillsRankingRetypedRankProps>> = ({
         onFinish,
         skillsRankingState,
       }) => {
  const jobPlatformUrl = useMemo(() => (
    SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl
  ), [])
  const theme = useTheme();
  const [value, setValue] = useState(0);
  const [startedEditing, setStartedEditing] = useState(false);
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);
  const [submitted, setSubmitted] = useState(false);

  const handleUpdateState = async () => {
    if (skillsRankingState.phase === SkillsRankingPhase.RETYPED_RANK) {
      if (!activeSessionId) {
        throw new SkillsRankingError("Active session ID is not available.");
      }
      try {
        const newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          SkillsRankingPhase.COMPLETED,
          undefined,
          undefined,
          value
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

  const handleChange = (_: Event, newValue: number | number[]) => {
    setStartedEditing(true)
    setValue(newValue as number);
  };

  const handleSubmit = async () => {
    if (skillsRankingState.phase === SkillsRankingPhase.RETYPED_RANK) {
      await handleUpdateState();
    }
  };

  useEffect(() => {
    if(skillsRankingState.phase !== SkillsRankingPhase.RETYPED_RANK){
      setValue(skillsRankingState.retyped_rank_percentile ?? 0)
    }
  }, [skillsRankingState])

  if (skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_2 || skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_4)
  {
    return null; // Skip this component for GROUP_2 and GROUP_4
  }

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_CONTAINER}
    >
      <ChatBubble
        sender={ConversationMessageSender.COMPASS}
        message={
          `In any case, if we do not think about other job seekers but again focus on those opportunities available to you, let's move to creating your skills profile that you can share with those employers in the next step.

          As a last question, let's remind ourselves of what I told you further above: check again what I said three messages ago, how many percent of opportunities on ${jobPlatformUrl} do you fulfill the required & most relevant skills of?`
        }
      >
        <Box mt={theme.spacing(3)} px={1}>
          <Slider
            value={value}
            onChange={handleChange}
            disabled={skillsRankingState.phase !== SkillsRankingPhase.RETYPED_RANK || submitted || !isOnline}
            min={0}
            max={100}
            step={1}
            valueLabelDisplay={value === 0 ? "off" : "on"}
            marks={[
              { value: 0, label: "0" },
              { value: 100, label: "100" },
            ]}
            data-testid={DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_SLIDER}
            sx={{
              '& .MuiSlider-valueLabel': {
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.common.black,
                fontWeight: 'bold',
                borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.sm)
              },
            }}
          />

          <Box mt={theme.spacing(2)} textAlign="right">
            <PrimaryButton
              onClick={handleSubmit}
              disabled={!startedEditing || skillsRankingState.phase !== SkillsRankingPhase.RETYPED_RANK || submitted || !isOnline}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_SUBMIT_BUTTON}
            >
              Submit
            </PrimaryButton>
          </Box>
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingRetypedRank;
