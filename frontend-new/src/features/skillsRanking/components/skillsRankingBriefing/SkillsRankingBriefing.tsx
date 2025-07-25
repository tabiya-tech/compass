import React, { useMemo, useContext, useState, useCallback, useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
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

const TYPING_DURATION_MS = 5000;

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

const getEffortTypeForGroup = (
  group: SkillsRankingExperimentGroups
): "TIME_BASED" | "WORK_BASED" => {
  switch (group) {
    case SkillsRankingExperimentGroups.GROUP_1:
    case SkillsRankingExperimentGroups.GROUP_4:
      return "TIME_BASED";
    case SkillsRankingExperimentGroups.GROUP_2:
    case SkillsRankingExperimentGroups.GROUP_3:
      return "WORK_BASED";
    default:
      throw new SkillsRankingError("Invalid experiment group.");
  }
};

export const SKILLS_RANKING_BRIEFING_MESSAGE_ID = `skills-ranking-briefing-message-${uniqueId}`;

export interface SkillsRankingBriefingProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingBriefing: React.FC<Readonly<SkillsRankingBriefingProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const jobPlatformUrl = useMemo(
    () => SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl,
    []
  );
  const activeSessionId =
    UserPreferencesStateService.getInstance().getActiveSessionId();
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const isReplay = skillsRankingState.phase !== SkillsRankingPhase.BRIEFING;
  const effortType = getEffortTypeForGroup(skillsRankingState.experiment_group);

  const [submitted, setSubmitted] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);
  const [showSecondMessage, setShowSecondMessage] = useState(
    effortType === "TIME_BASED"
  );

  const currentScrollStep= useMemo(() => {
    if (isTypingVisible) return ScrollStep.TYPING;
    if (showSecondMessage) return ScrollStep.SECOND_MESSAGE;
    return ScrollStep.INITIAL;
  }, [isTypingVisible, showSecondMessage]);

  const scrollRef = useAutoScrollOnChange(currentScrollStep);

  useEffect(() => {
    if (effortType === "WORK_BASED" && !isReplay) {
      const timeout = setTimeout(() => setShowSecondMessage(true), TYPING_DURATION_MS);
      return () => clearTimeout(timeout);
    }
  }, [effortType, isReplay]);

  const handleContinue = useCallback(async () => {
    setSubmitted(true);
    setIsTypingVisible(true);

    const start = Date.now();
    let newSkillsRankingState: SkillsRankingState | null = null;

    try {
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
    const remaining = Math.max(0, TYPING_DURATION_MS - elapsed);

    setTimeout(() => {
      setIsTypingVisible(false);
      newSkillsRankingState && onFinish(newSkillsRankingState);
    }, remaining);
  }, [activeSessionId, onFinish, enqueueSnackbar]);

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTAINER}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      {/* TIME_BASED or first WORK_BASED message */}
      <ChatBubble
        message={
          effortType === "WORK_BASED"
            ? `If you are interested, I can calculate what share of ${jobPlatformUrl} opportunities match your skills and how you compare with other seekers — you just need to show me how valuable this information is to you.`
            : `I will now calculate how many percent of jobs advertised on ${jobPlatformUrl} you have the required & most relevant skills for, and how you compare to other job seekers. This will take some time — if you are not interested you can click "cancel" in the next message, while I calculate. When you are ready please click continue.`
        }
        sender={ConversationMessageSender.COMPASS}
      >
        {/* Only show button here for TIME_BASED */}
        {effortType === "TIME_BASED" && (
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

      {/* Typing between WORK_BASED messages */}
      <AnimatePresence mode="wait">
        {effortType === "WORK_BASED" && !isReplay && !showSecondMessage && (
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
      {effortType === "WORK_BASED" && showSecondMessage && (
        <ChatBubble
          message={`You’ll see tilted letters on a few screens. Turn each letter upright using the rotation buttons. You can quit anytime.`}
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
