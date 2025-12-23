import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { getLatestPhaseName, SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
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
import { getJobPlatformUrl, getLongTypingDurationMs } from "src/features/skillsRanking/constants";
import { shouldSkipMarketDisclosure } from "src/features/skillsRanking/utils/createMessages";

const uniqueId = "579104a2-f36b-4ca5-a0c5-b2b44aaa52e1";

enum MarketDisclosureStep {
  SHOW_MESSAGE = 0,
  SHOW_TYPING = 1,
  COMPLETED = 2,
}

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
  const [step, setStep] = useState<MarketDisclosureStep>(MarketDisclosureStep.SHOW_MESSAGE);
  const scrollRef = useAutoScrollOnChange(step);
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = useMemo(() => currentPhase !== SkillsRankingPhase.MARKET_DISCLOSURE, [currentPhase]);

  // Use the utility function instead of local variable
  const shouldSkip = !isReplay && shouldSkipMarketDisclosure(skillsRankingState.experiment_group);

  const hasFinishedRef = useRef(false);

  const { t } = useTranslation();
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
      enqueueSnackbar(t("common.errors.updateState"), {
        variant: "error",
      });
    }
  }, [onFinish, enqueueSnackbar, t]);

  useEffect(() => {
    if (shouldSkip) {
      handleContinue().then();
      return;
    }

    if (isReplay) return;

    const timers: NodeJS.Timeout[] = [];

    if (step === MarketDisclosureStep.SHOW_MESSAGE) {
      timers.push(setTimeout(() => setStep(MarketDisclosureStep.SHOW_TYPING), getLongTypingDurationMs()));
    } else if (step === MarketDisclosureStep.SHOW_TYPING) {
      timers.push(
        setTimeout(() => {
          setStep(MarketDisclosureStep.COMPLETED);
          handleContinue().then();
        }, getLongTypingDurationMs())
      );
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [step, isReplay, shouldSkip, handleContinue]);

  // gets skipped for groups 2 and 4
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
              {t("features.skillsRanking.components.skillsRankingDisclosure.skillsRankingMarketDisclosure.message_1")}
              <strong>{skillsRankingState.score.jobs_matching_rank}%</strong>
              {t("features.skillsRanking.components.skillsRankingDisclosure.skillsRankingMarketDisclosure.message_2")}
              {getJobPlatformUrl()}
              {t("features.skillsRanking.components.skillsRankingDisclosure.skillsRankingMarketDisclosure.message_3")}
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
        {step === MarketDisclosureStep.SHOW_TYPING && (
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
