import React, { useState, useMemo, useContext, useEffect, useRef, useCallback } from "react";
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
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";

const uniqueId = "eb90de4c-2462-4b6d-8b9c-1b5c6ae64129";
const TYPING_DURATION_MS = 5000;

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
  const theme = useTheme();
  const [value, setValue] = useState(0);
  const [startedEditing, setStartedEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0); // 0: form, 1: typing, 2: finish
  const hasFinishedRef = useRef(false);

  const jobPlatformUrl = useMemo(() => (
    SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl
  ), []);
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const scrollRef = useAutoScrollOnChange(step);

  const isAutoSubmitGroup =
    skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_2 ||
    skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_4;

  const handleUpdateState = useCallback(async () => {
    if (!activeSessionId) {
      throw new SkillsRankingError("Active session ID is not available.");
    }
    try {
      const newState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.COMPLETED,
        undefined,
        value
      );
      setSubmitted(true);
      setStep(1);
      setTimeout(() => setStep(2), TYPING_DURATION_MS);
      setTimeout(() => {
        if (!hasFinishedRef.current) {
          hasFinishedRef.current = true;
          onFinish(newState);
        }
      }, TYPING_DURATION_MS + 300);
    } catch (err) {
      console.error("Failed to update state:", err);
      enqueueSnackbar("Something went wrong. Please try again.", { variant: "error" });
    }
  }, [activeSessionId, value, onFinish, enqueueSnackbar]);

  const handleSubmit = async () => {
    if (!submitted && skillsRankingState.phase === SkillsRankingPhase.RETYPED_RANK) {
      await handleUpdateState();
    }
  };

  useEffect(() => {
    if (skillsRankingState.phase !== SkillsRankingPhase.RETYPED_RANK) {
      setValue(skillsRankingState.retyped_rank_percentile ?? 0);
    }
  }, [skillsRankingState]);

  useEffect(() => {
    if (isAutoSubmitGroup && !hasFinishedRef.current) {
      setStep(1); // Show typing animation
      const typingTimer = setTimeout(async () => {
        if (!activeSessionId) return;

        if (skillsRankingState.phase !== SkillsRankingPhase.RETYPED_RANK) {
          console.warn(
            `[RetypedRank] Skipping auto-submit. Phase is already ${skillsRankingState.phase}`
          );
          return;
        }

        hasFinishedRef.current = true;
        try {
          const newState = await SkillsRankingService.getInstance().updateSkillsRankingState(
            activeSessionId,
            SkillsRankingPhase.COMPLETED,
            undefined,
            value
          );
          await onFinish(newState);
        } catch (err) {
          console.error("Failed to update state:", err);
          enqueueSnackbar("Something went wrong. Please try again.", { variant: "error" });
        }
      }, TYPING_DURATION_MS);

      return () => clearTimeout(typingTimer);
    }
  }, [
    isAutoSubmitGroup,
    activeSessionId,
    skillsRankingState.phase,
    value,
    onFinish,
    enqueueSnackbar,
  ]);

  if (isAutoSubmitGroup) return null;

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      ref={scrollRef}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      {(!isAutoSubmitGroup) &&
      <ChatBubble
        sender={ConversationMessageSender.COMPASS}
        message={`In any case, if we do not think about other job seekers but again focus on those opportunities available to you, let's move to creating your skills profile that you can share with those employers in the next step.\n\nAs a last question, let's remind ourselves of what I told you further above: check again what I said three messages ago, how many percent of opportunities on ${jobPlatformUrl} do you fulfill the required & most relevant skills of?`}
      >
        <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
          <Slider
            value={value}
            onChange={(_, newVal) => {
              setStartedEditing(true);
              setValue(newVal as number);
            }}
            disabled={submitted || !isOnline ||
              skillsRankingState.phase !== SkillsRankingPhase.RETYPED_RANK}
            min={0}
            max={100}
            step={1}
            marks={[
              { value: 0, label: "" },
              { value: 100, label: "" },
            ]}
            valueLabelDisplay={value === 0 ? "off" : "on"}
            data-testid={DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_SLIDER}
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
                skillsRankingState.phase !== SkillsRankingPhase.RETYPED_RANK
              }
              data-testid={DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_SUBMIT_BUTTON}
            >
              Submit
            </PrimaryButton>
          </Box>
        </Box>
      </ChatBubble>
      }

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="typing"
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

export default SkillsRankingRetypedRank;
