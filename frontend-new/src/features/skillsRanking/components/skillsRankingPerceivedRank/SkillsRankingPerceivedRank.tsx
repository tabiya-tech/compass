import React, { useState, useMemo, useContext, useEffect } from "react";
import { Box, Slider, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";

const uniqueId = "7c582beb-6070-43b0-92fb-7fd0a4cb533e";
const TYPING_DURATION_MS = 5000;

export const DATA_TEST_ID = {
  SKILLS_RANKING_PERCEIVED_RANK_CONTAINER: `skills-ranking-perceived-rank-container-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_SLIDER: `skills-ranking-perceived-rank-slider-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON: `skills-ranking-perceived-rank-submit-button-${uniqueId}`,
};

export const SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID = `skills-ranking-perceived-rank-message-${uniqueId}`;

export interface SkillsRankingPerceivedRankProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingPerceivedRank: React.FC<Readonly<SkillsRankingPerceivedRankProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const jobPlatformUrl = useMemo(() => (
    SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl
  ), []);

  const [value, setValue] = useState(0);
  const [startedEditing, setStartedEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showTyping, setShowTyping] = useState(false);

  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const scrollRef = useAutoScrollOnChange(submitted ? 1 : 0);

  const handleChange = (_: Event, newValue: number | number[]) => {
    setStartedEditing(true);
    setValue(newValue as number);
  };

  const handleSubmit = async () => {
    if (
      submitted ||
      !startedEditing ||
      !isOnline ||
      skillsRankingState.phase !== SkillsRankingPhase.PERCEIVED_RANK
    ) {
      return;
    }

    setSubmitted(true);
    setShowTyping(true);

    try {
      if (!activeSessionId) {
        console.error(new SkillsRankingError("Active session ID is not available."));
        return;
      }

      const updatedState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.RETYPED_RANK,
        value
      );

      // Wait the full typing duration before calling onFinish
      setTimeout(() => {
        setShowTyping(false);
        onFinish(updatedState);
      }, TYPING_DURATION_MS);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
      enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
        variant: "error",
      });
      setShowTyping(false);
      setSubmitted(false); // allow retry
    }
  };

  useEffect(() => {
    if (skillsRankingState.phase !== SkillsRankingPhase.PERCEIVED_RANK) {
      setValue(skillsRankingState.perceived_rank_percentile ?? 0);
    }
  }, [skillsRankingState]);

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      ref={scrollRef}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <ChatBubble
        sender={ConversationMessageSender.COMPASS}
        message={`Now, think of 100 people who are jobseekers from South Africa aged 18–34 with a matric from a township or rural school. How many of these 100 job seekers do you believe would be a fit for fewer positions on ${jobPlatformUrl} than you?`}
      >
        <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
          <Slider
            value={value}
            onChange={handleChange}
            disabled={submitted || !isOnline||
              skillsRankingState.phase !== SkillsRankingPhase.PERCEIVED_RANK}
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
              height: theme.fixedSpacing(theme.tabiyaSpacing.md),
              '& .MuiSlider-track': {
                backgroundColor: theme.palette.success.main,
                borderRadius: theme.rounding(theme.tabiyaRounding.xs),
              },
              '& .MuiSlider-rail': {
                backgroundColor: theme.palette.common.white,
                border: `1px solid ${theme.palette.grey[300]}`,
                borderRadius: theme.rounding(theme.tabiyaRounding.xs),
              },
              '& .MuiSlider-thumb': {
                boxShadow: 'none',
                borderRadius: theme.rounding(theme.tabiyaRounding.xs),
                width: theme.fixedSpacing(theme.tabiyaSpacing.lg),
                height: theme.fixedSpacing(theme.tabiyaSpacing.lg),
              },
              '& .MuiSlider-valueLabel': {
                backgroundColor: theme.palette.success.main,
                color: theme.palette.common.black,
                fontWeight: 'bold',
                borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                top: -10,
              },
              '& .MuiSlider-mark': {
                display: 'none',
              },
            }}
          />

          <Box mt={theme.spacing(2)} textAlign="right">
            <PrimaryButton
              onClick={handleSubmit}
              disabled={
                submitted ||
                !startedEditing ||
                !isOnline ||
                skillsRankingState.phase !== SkillsRankingPhase.PERCEIVED_RANK
              }
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON}
            >
              Submit
            </PrimaryButton>
          </Box>
        </Box>
      </ChatBubble>

      <AnimatePresence mode="wait">
        {showTyping && (
          <motion.div
            key="typing-feedback"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TypingChatMessage />
          </motion.div>
        )}
      </AnimatePresence>
    </MessageContainer>
  );
};

export default SkillsRankingPerceivedRank;
