import React, { useState, useMemo, useContext, useEffect } from "react";
import { Box, Slider, useTheme } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "../../errors";
import UserPreferencesStateService from "../../../../userPreferences/UserPreferencesStateService";
import { IsOnlineContext } from "../../../../app/isOnlineProvider/IsOnlineProvider";
import { useSnackbar } from "../../../../theme/SnackbarProvider/SnackbarProvider";

const uniqueId = "7c582beb-6070-43b0-92fb-7fd0a4cb533e";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PERCEIVED_RANK_CONTAINER: `skills-ranking-perceived-rank-container-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_SLIDER: `skills-ranking-perceived-rank-slider-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON: `skills-ranking-perceived-rank-submit-button-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_PROGRESS_ICON: `skills-ranking-perceived-rank-progress-icon-${uniqueId}`
};

export interface SkillsRankingPerceivedRankProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

export const SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID = `skills-ranking-perceived-rank-message-${uniqueId}`;

const SkillsRankingPerceivedRank: React.FC<Readonly<SkillsRankingPerceivedRankProps>> = ({
         onFinish,
         skillsRankingState,
       }) => {
  const jobPlatformUrl = useMemo(() => (
    SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl
  ), [])
  const theme = useTheme();
  const [value, setValue] = useState(0);
  const [startedEditing, setStartedEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);
  const [submitted, setSubmitted] = useState(false);

  const handleUpdateState = async () => {
    if (skillsRankingState.phase === SkillsRankingPhase.PERCEIVED_RANK) {
      if (!activeSessionId) {
        throw new SkillsRankingError("Active session ID is not available.");
      }
      setIsSubmitting(true)
      try {
        const newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          SkillsRankingPhase.RETYPED_RANK,
          value,
        );
        onFinish(newSkillsRankingState);
      } catch (error) {
        console.error("Error updating skills ranking state:", error);
        enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
          variant: "error",
        });
      } finally {
        setIsSubmitting(false);
        setSubmitted(true);
      }
    }
  }

  const handleChange = (_: Event, newValue: number | number[]) => {
    setStartedEditing(true)
    setValue(newValue as number);
  };

  const handleSubmit = async () => {
    if (skillsRankingState.phase === SkillsRankingPhase.PERCEIVED_RANK) {
      await handleUpdateState()
    }
  };

  useEffect(() => {
    if(skillsRankingState.phase !== SkillsRankingPhase.PERCEIVED_RANK){
      setValue(skillsRankingState.perceived_rank_percentile ?? 0)
    }
  }, [skillsRankingState])

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_CONTAINER}
    >
      <ChatBubble
        sender={ConversationMessageSender.COMPASS}
        message={
          `Now, think of 100 people who are jobseekers from South Africa aged 18–34 with a matric from a township or rural school. How many of these 100 job seekers do you believe would be a fit for fewer positions on ${jobPlatformUrl} than you?`
        }
      >
        <Box mt={theme.spacing(3)} px={1}>
          <Slider
            value={value}
            onChange={handleChange}
            disabled={skillsRankingState.phase !== SkillsRankingPhase.PERCEIVED_RANK || !isOnline || submitted}
            min={0}
            max={100}
            step={1}
            valueLabelDisplay={value === 0 ? "off" : "on"}
            marks={[
              { value: 0, label: "0" },
              { value: 100, label: "100" },
            ]}
            data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SLIDER}
            sx={{
              height: 12,
              '& .MuiSlider-track': {
                backgroundColor: theme.palette.success.main,
                border: 'none',
              },
              '& .MuiSlider-rail': {
                backgroundColor: theme.palette.grey[200],
                opacity: 1,
              },
              '& .MuiSlider-thumb': {
                boxShadow: 'none',
              },
              '& .MuiSlider-valueLabel': {
                backgroundColor: theme.palette.success.main,
                color: theme.palette.common.black,
                fontWeight: 'bold',
                borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                top: -30,
              },
            }}
          />

          <Box mt={theme.spacing(2)} textAlign="right">
            <PrimaryButton
              onClick={handleSubmit}
              disabled={isSubmitting || !startedEditing || skillsRankingState.phase !== SkillsRankingPhase.PERCEIVED_RANK || !isOnline || submitted}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON}
              startIcon={isSubmitting && <CircularProgress
                sx={{ color: theme.palette.tabiyaBlue.main, marginRight: theme.fixedSpacing(theme.tabiyaSpacing.xs) }}
                size={theme.spacing(3)}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_PROGRESS_ICON}
              /> }
            >
              Submit
            </PrimaryButton>
          </Box>
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingPerceivedRank;
