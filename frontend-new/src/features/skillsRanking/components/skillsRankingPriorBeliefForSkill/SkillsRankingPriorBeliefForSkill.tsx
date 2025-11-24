import React, { useContext, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import SkillsRankingSlider from "src/features/skillsRanking/components/skillsRankingSlider/SkillsRankingSlider";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { AnimatePresence, motion } from "framer-motion";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import {
  SkillsRankingPhase,
  SkillsRankingState,
  getLatestPhaseName,
} from "src/features/skillsRanking/types";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { getDefaultTypingDurationMs } from "src/features/skillsRanking/constants";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import { getNextPhaseForGroup } from "src/features/skillsRanking/hooks/skillsRankingFlowGraph";

const uniqueId = "75e03749-9172-41d8-a45f-2fbe64b07a4b";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_CONTAINER: `skills-ranking-prior-belief-for-skill-container-${uniqueId}`,
  SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SLIDER: `skills-ranking-prior-belief-for-skill-slider-${uniqueId}`,
  SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON: `skills-ranking-prior-belief-for-skill-submit-button-${uniqueId}`,
};

export interface SkillsRankingPriorBeliefForSkillProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

enum ScrollStep {
  INITIAL = "INITIAL",
  TYPING = "TYPING",
}

export const SKILLS_RANKING_PRIOR_BELIEF_FOR_SKIll_MESSAGE_ID = `skills-ranking-prior-belief-for-skill-message`;

const SkillsRankingPriorBeliefForSkill: React.FC<Readonly<SkillsRankingPriorBeliefForSkillProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const existingValue = skillsRankingState.user_responses.prior_belief_for_skill_percentile ?? 0;
  const [value, setValue] = useState(existingValue);
  const [startedEditing, setStartedEditing] = useState(existingValue > 0);
  const [submitted, setSubmitted] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);

  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = currentPhase !== SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL;

  const leastDemandedSkillLabel = skillsRankingState.score.least_demanded_label;

  const currentScrollStep = useMemo(() => {
    if (isTypingVisible) return ScrollStep.TYPING;
    return ScrollStep.INITIAL;
  }, [isTypingVisible]);

  const scrollRef = useAutoScrollOnChange(currentScrollStep);

  const handleChange = (_: Event, newValue: number | number[]) => {
    setStartedEditing(true);
    setValue(newValue as number);
  };

  const handleSubmit = async () => {
    if (isReplay || submitted || !startedEditing || !isOnline || currentPhase !== SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL) {
      return;
    }

    setSubmitted(true);
    setIsTypingVisible(true);

    try {
      const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (!activeSessionId) {
        console.error(new SkillsRankingError("Active session ID is not available."));
        return;
      }

      const nextPhase = getNextPhaseForGroup(
        skillsRankingState.metadata.experiment_group,
        SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL
      );
      if (!nextPhase) {
        console.error(new SkillsRankingError("No next phase found for PRIOR_BELIEF_FOR_SKILL"));
        return;
      }

      const updatedState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        nextPhase,
        { prior_belief_for_skill: value }
      );

      // Wait the full typing duration before calling onFinish
      setTimeout(() => {
        setIsTypingVisible(false);
        onFinish(updatedState);
      }, getDefaultTypingDurationMs());
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
      enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
        variant: "error",
      });
      setIsTypingVisible(false);
      setSubmitted(false);
    }
  };


  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      ref={scrollRef}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_CONTAINER}
    >
      {/* FIRST MESSAGE */}
      <Box sx={{ width: "100%" }}>
        <ChatBubble
          sender={ConversationMessageSender.COMPASS}
          message={
            <Typography>
              <strong>And what is the chance</strong> (0–100%) that your <strong>{leastDemandedSkillLabel} is 'above average'</strong> in demand?
            </Typography>
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <SkillsRankingSlider
              value={value}
              onChange={handleChange}
              disabled={isReplay || submitted || !isOnline || currentPhase !== SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL}
              aria-label="Prior belief for skill slider"
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SLIDER}
            />

            <Box mt={theme.spacing(2)} textAlign="right">
              <PrimaryButton
                onClick={handleSubmit}
                disabled={isReplay || !startedEditing || submitted || !isOnline || currentPhase !== SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON}
              >
                Submit
              </PrimaryButton>
            </Box>
          </Box>
        </ChatBubble>

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp sentAt={skillsRankingState.phase.at(-1)?.time || skillsRankingState.metadata.started_at} />
        </ChatMessageFooterLayout>
      </Box>

      <AnimatePresence mode="wait">
        {isTypingVisible && (
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

export default SkillsRankingPriorBeliefForSkill;
