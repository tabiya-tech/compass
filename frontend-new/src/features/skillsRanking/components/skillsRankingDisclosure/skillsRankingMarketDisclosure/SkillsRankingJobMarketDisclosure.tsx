import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
  getLatestPhaseName,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import { useTheme } from "@mui/material/styles";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { Box } from "@mui/material";
import { getJobPlatformUrl } from "src/features/skillsRanking/constants";

const TYPING_DURATION_MS = 5000;

const uniqueId = "579104a2-f36b-4ca5-a0c5-b2b44aaa52e1";

export const DATA_TEST_ID = {
  SKILLS_RANKING_JOB_MARKET_DISCLOSURE_CONTAINER: `skills-ranking-job-market-disclosure-container-${uniqueId}`,
};

export const SKILLS_RANKING_JOB_MARKET_DISCLOSURE_MESSAGE_ID = `skills-ranking-job-market-disclosure-message-${uniqueId}`;

export interface SkillsRankingJobMarketDisclosureProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingJobMarketDisclosure: React.FC<SkillsRankingJobMarketDisclosureProps> = ({
  onFinish,
  skillsRankingState,
}) => {
  const [step, setStep] = useState(0); // 0: message, 1: typing, 2: done
  const scrollRef = useAutoScrollOnChange(step);
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = useMemo(() => currentPhase !== SkillsRankingPhase.MARKET_DISCLOSURE, [currentPhase]);

  const shouldSkip =
    !isReplay &&
    (skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_2 ||
      skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_4);

  const hasFinishedRef = useRef(false);

  const handleContinue = useCallback(async () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!activeSessionId) {
      throw new SkillsRankingError("Active session ID is not available.");
    }

    try {
      const newState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.JOB_SEEKER_DISCLOSURE
      );
      await onFinish(newState);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
      enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
        variant: "error",
      });
    }
  }, [onFinish, enqueueSnackbar]);

  useEffect(() => {
    if (shouldSkip) {
      handleContinue();
      return;
    }

    if (isReplay) return;

    const timers: NodeJS.Timeout[] = [];

    if (step === 0) {
      timers.push(setTimeout(() => setStep(1), TYPING_DURATION_MS));
    } else if (step === 1) {
      timers.push(
        setTimeout(() => {
          setStep(2);
          handleContinue();
        }, TYPING_DURATION_MS)
      );
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [step, isReplay, shouldSkip, handleContinue]);

  if (shouldSkip) return null;

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_JOB_MARKET_DISCLOSURE_CONTAINER}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble
          message={
            <>
              With your current skillset you fulfill the required & most relevant skills of{" "}
              {skillsRankingState.score.jobs_matching_rank}% of jobs on <strong>{getJobPlatformUrl()}</strong>. This is
              quite some jobs!
            </>
          }
          sender={ConversationMessageSender.COMPASS}
        />

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp
            sentAt={
              skillsRankingState.phases[skillsRankingState.phases.length - 1]?.time || skillsRankingState.started_at
            }
          />
        </ChatMessageFooterLayout>
      </Box>

      <AnimatePresence mode="wait">
        {step === 1 && (
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

export default SkillsRankingJobMarketDisclosure;
