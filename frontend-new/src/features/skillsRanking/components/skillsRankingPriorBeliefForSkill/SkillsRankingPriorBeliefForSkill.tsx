import React, { useContext, useEffect, useMemo, useState } from "react";
import { Box, useTheme } from "@mui/material";
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
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
  getLatestPhaseName,
} from "src/features/skillsRanking/types";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { getDefaultTypingDurationMs } from "src/features/skillsRanking/constants";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import { demandSummaryMock } from "../skillsRankingPriorBelief/SkillsRankingPriorBelief";

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
  INITIAL = 0,
  TYPING = 1,
  SECOND_MESSAGE = 2,
}

const READY_MESSAGE_DURATION_MS = 5000; // Duration to show the ready message before typing starts

export const SKILLS_RANKING_PRIOR_BELIEF_FOR_SKIll_MESSAGE_ID = `skills-ranking-prior-belief-for-skill-message`;

const leastDemandedSkillLabel = demandSummaryMock.least_demanded_label;

const SkillsRankingPriorBeliefForSkill: React.FC<Readonly<SkillsRankingPriorBeliefForSkillProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const [value, setValue] = useState(0);
  const [startedEditing, setStartedEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);
  const [showSecondMessage, setShowSecondMessage] = useState(false);

  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);

  const shouldShowReadyMessage =
    skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_2 ||
    skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_3;

  const currentScrollStep = useMemo(() => {
    if (isTypingVisible) return ScrollStep.TYPING;
    if (showSecondMessage) return ScrollStep.SECOND_MESSAGE;
    return ScrollStep.INITIAL;
  }, [isTypingVisible, showSecondMessage]);

  const scrollRef = useAutoScrollOnChange(currentScrollStep);

  const handleChange = (_: Event, newValue: number | number[]) => {
    setStartedEditing(true);
    setValue(newValue as number);
  };

  const handleSubmit = async () => {
    if (submitted || !startedEditing || !isOnline || currentPhase !== SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL) {
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

      const updatedState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.MARKET_DISCLOSURE,
        value
      );

      // Wait the full typing duration before calling onFinish
      setTimeout(() => {
        setIsTypingVisible(false);
        setShowSecondMessage(true);

        // Only call onFinish if we're NOT showing the ready message
        if (!shouldShowReadyMessage) {
          onFinish(updatedState);
        }
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

  useEffect(() => {
    if (!showSecondMessage || !shouldShowReadyMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setIsTypingVisible(true);

      // Hide typing and move to the next phase after typing duration
      const typingTimeout = setTimeout(() => {
        setIsTypingVisible(false);

        // Call onFinish after typing to move to the next phase
        onFinish(skillsRankingState).then();
      }, getDefaultTypingDurationMs());

      return () => clearTimeout(typingTimeout);
    }, READY_MESSAGE_DURATION_MS);

    return () => clearTimeout(timeout);
  }, [showSecondMessage, shouldShowReadyMessage, onFinish, skillsRankingState]);

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
            <>
              <strong>And what is the chance</strong> (0–100%) that your{" "}
              <strong>{leastDemandedSkillLabel} is 'above average'</strong> in demand?
            </>
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <SkillsRankingSlider
              value={value}
              onChange={handleChange}
              disabled={submitted || !isOnline || currentPhase !== SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL}
              aria-label="Prior belief for skill slider"
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SLIDER}
            />

            <Box mt={theme.spacing(2)} textAlign="right">
              <PrimaryButton
                onClick={handleSubmit}
                disabled={!startedEditing || submitted || !isOnline}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON}
              >
                Submit
              </PrimaryButton>
            </Box>
          </Box>
        </ChatBubble>

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp sentAt={skillsRankingState.phases.at(-1)?.time || skillsRankingState.started_at} />
        </ChatMessageFooterLayout>
      </Box>

      {showSecondMessage && shouldShowReadyMessage && (
        <Box sx={{ width: "100%" }}>
          <ChatBubble sender={ConversationMessageSender.COMPASS} message={<>Great, the information is now ready:</>} />

          <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
            <Timestamp sentAt={skillsRankingState.phases.at(-1)?.time || skillsRankingState.started_at} />
          </ChatMessageFooterLayout>
        </Box>
      )}

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
