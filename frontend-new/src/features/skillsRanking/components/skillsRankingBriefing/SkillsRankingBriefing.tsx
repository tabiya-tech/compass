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
      enqueueSnackbar("Failed to continue. Please try again later.", { variant: "error" });
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
  }, [onFinish, enqueueSnackbar]);

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
              <>
                If you are interested,  <strong>I can calculate what share of </strong>{getJobPlatformUrl()}{" "}
                <strong>opportunities match your skills and how you compare with other seekers</strong> — you just need to show me how
                valuable this information is to you.
              </>
            ) : (
              <>
                If you are interested,  <strong>I can calculate what share of </strong>{getJobPlatformUrl()}{" "}
                <strong>opportunities match your skills and how you compare with other seekers</strong> This might take
                some time — if you are not interested in waiting any longer, you can click <strong>cancel</strong> at any time in the next message,
                while I calculate. <br/><br/>When you are ready please click <strong>continue</strong>.
              </>
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
                Continue
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
            message={<>
              You'll see tilted letters on a few screens. Turn each letter upright using the rotation buttons. You can cancel anytime. In 5% of cases, <strong>more letters fixed = higher chance of receiving the information.</strong> The rest of the time it depends on me.
            </>}
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
                Continue
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
