import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Box, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  EffortType,
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
  getLatestPhaseName,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { getDefaultTypingDurationMs, getJobPlatformUrl } from "src/features/skillsRanking/constants";
import { useTranslation, Trans } from "react-i18next";

const uniqueId = "0e95404a-2044-4634-a6e8-29cc7b2d754e";

export const DATA_TEST_ID = {
  SKILLS_RANKING_BRIEFING_CONTAINER: `skills-ranking-briefing-container-${uniqueId}`,
  SKILLS_RANKING_BRIEFING_CONTINUE_BUTTON: `skills-ranking-briefing-continue-button-${uniqueId}`,
};

enum ScrollStep {
  INITIAL = 0,
  TYPING = 1,
  SECOND_MESSAGE = 2,
}

const getEffortTypeForGroup = (group: SkillsRankingExperimentGroups): EffortType => {
  switch (group) {
    case SkillsRankingExperimentGroups.GROUP_1:
    case SkillsRankingExperimentGroups.GROUP_4:
      return EffortType.TIME_BASED;
    case SkillsRankingExperimentGroups.GROUP_2:
    case SkillsRankingExperimentGroups.GROUP_3:
      return EffortType.WORK_BASED;
    default:
      throw new SkillsRankingError("Invalid experiment group.");
  }
};

export const SKILLS_RANKING_BRIEFING_MESSAGE_ID = `skills-ranking-briefing-message-${uniqueId}`;

export interface SkillsRankingBriefingProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingBriefing: React.FC<Readonly<SkillsRankingBriefingProps>> = ({ onFinish, skillsRankingState }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);

  const isReplay = currentPhase !== SkillsRankingPhase.BRIEFING;

  const effortType = getEffortTypeForGroup(skillsRankingState.experiment_group);

  const [submitted, setSubmitted] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);
  const [showSecondMessage, setShowSecondMessage] = useState(
    effortType === EffortType.TIME_BASED || (effortType === EffortType.WORK_BASED && isReplay)
  );

  const currentScrollStep = useMemo(() => {
    if (isTypingVisible) return ScrollStep.TYPING;
    if (showSecondMessage) return ScrollStep.SECOND_MESSAGE;
    return ScrollStep.INITIAL;
  }, [isTypingVisible, showSecondMessage]);

  const scrollRef = useAutoScrollOnChange(currentScrollStep);

  useEffect(() => {
    if (effortType === EffortType.WORK_BASED && !isReplay) {
      const timeout = setTimeout(() => setShowSecondMessage(true), getDefaultTypingDurationMs());
      return () => clearTimeout(timeout);
    }
  }, [effortType, isReplay]);

  const handleContinue = useCallback(async () => {
    setSubmitted(true);
    setIsTypingVisible(true);

    const start = Date.now();
    let newSkillsRankingState: SkillsRankingState | null = null;

    try {
      const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

      if (!activeSessionId) {
        console.error(new SkillsRankingError("No session ID."));
        return;
      }

      newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.PROOF_OF_VALUE
      );
    } catch (err) {
      console.error(err);
      enqueueSnackbar(t("skillsRanking_briefing_failed_to_continue"), { variant: "error" });
      setSubmitted(false);
      setIsTypingVisible(false);
      return;
    }

    const elapsed = Date.now() - start;
    const remaining = Math.max(0, getDefaultTypingDurationMs() - elapsed);

    setTimeout(() => {
      setIsTypingVisible(false);
      newSkillsRankingState && onFinish(newSkillsRankingState);
    }, remaining);
  }, [onFinish, enqueueSnackbar, t]);

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTAINER}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        {/* TIME_BASED or first WORK_BASED message */}
        <ChatBubble
          message={
            effortType === EffortType.WORK_BASED ? (
              <Trans
                i18nKey="skillsRanking_briefing_intro_work_based"
                components={[<strong />]}
                values={{ jobPlatformUrl: getJobPlatformUrl() }}
              />
            ) : (
              <Trans
                i18nKey="skillsRanking_briefing_intro_time_based"
                components={[<strong />, <strong />]}
                values={{ jobPlatformUrl: getJobPlatformUrl() }}
              />
            )
          }
          sender={ConversationMessageSender.COMPASS}
        >
          {/* Only show button here for TIME_BASED */}
          {effortType === EffortType.TIME_BASED && (
            <Box
              display="flex"
              flexDirection="row"
              justifyContent="flex-end"
              padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
            >
              <PrimaryButton
                onClick={handleContinue}
                disabled={isReplay || !isOnline || submitted || isTypingVisible}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTINUE_BUTTON}
              >
                {t("skillsRanking_common_continue_button")}
              </PrimaryButton>
            </Box>
          )}
        </ChatBubble>

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp
            sentAt={
              skillsRankingState.phases[skillsRankingState.phases.length - 1]?.time || skillsRankingState.started_at
            }
          />
        </ChatMessageFooterLayout>
      </Box>

      {/* Typing between WORK_BASED messages */}
      <AnimatePresence mode="wait">
        {effortType === EffortType.WORK_BASED && !isReplay && !showSecondMessage && (
          <motion.div
            key="typing-transition"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TypingChatMessage />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Second WORK_BASED message + button */}
      {effortType === EffortType.WORK_BASED && showSecondMessage && (
        <Box sx={{ width: "100%" }}>
          <ChatBubble
            message={
              <Trans
                i18nKey="skillsRanking_briefing_puzzle_instructions"
                components={[<strong />]}
              />
            }
            sender={ConversationMessageSender.COMPASS}
          >
            <Box
              display="flex"
              flexDirection="row"
              justifyContent="flex-end"
              padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
            >
              <PrimaryButton
                onClick={handleContinue}
                disabled={isReplay || !isOnline || submitted || isTypingVisible}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTINUE_BUTTON}
              >
                {t("skillsRanking_common_continue_button")}
              </PrimaryButton>
            </Box>
          </ChatBubble>

          <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
            <Timestamp
              sentAt={
                skillsRankingState.phases[skillsRankingState.phases.length - 1]?.time || skillsRankingState.started_at
              }
            />
          </ChatMessageFooterLayout>
        </Box>
      )}

      {/* Final typing shown after clicking continue */}
      <AnimatePresence mode="wait">
        {isTypingVisible && (
          <motion.div
            key="final-typing"
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

export default SkillsRankingBriefing;
