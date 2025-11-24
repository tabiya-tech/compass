import React, { useCallback, useContext, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { SkillsRankingPhase, SkillsRankingState, getLatestPhaseName } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { getDefaultTypingDurationMs } from "src/features/skillsRanking/constants";

const uniqueId = "eee627fe-a483-46d8-98e4-3a4eab72920a";

export const PROOF_OF_VALUE_INTRO_MESSAGE_ID = `skills-ranking-proof-of-value-intro-message-${uniqueId}`;

export const DATA_TEST_ID = {
  PROOF_OF_VALUE_INTRO_CONTAINER: `proof-of-value-intro-container-${uniqueId}`,
  PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON: `proof-of-value-intro-continue-button-${uniqueId}`,
};

enum ScrollStep {
  INITIAL = 0,
  TYPING = 1,
}

export interface ProofOfValueIntroProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingProofOfValueIntro: React.FC<Readonly<ProofOfValueIntroProps>> = ({ onFinish, skillsRankingState }) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = currentPhase !== SkillsRankingPhase.PROOF_OF_VALUE_INTRO;

  const [submitted, setSubmitted] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);

  const currentScrollStep = useMemo(() => {
    if (isTypingVisible) return ScrollStep.TYPING;
    return ScrollStep.INITIAL;
  }, [isTypingVisible]);

  const scrollRef = useAutoScrollOnChange(currentScrollStep);

  const handleContinue = useCallback(async () => {
    setSubmitted(true);
    setIsTypingVisible(true);

    const start = Date.now();
    let newSkillsRankingState: SkillsRankingState | null = null;

    try {
      const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

      if (!activeSessionId) {
        console.error("No session ID.");
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
      data-testid={DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTAINER}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble
          message={
            <Typography>
              You'll see tilted letters on a few screens. Turn each letter upright using the rotation buttons. You can
              cancel anytime. In 5% of cases, <strong>more letters fixed = higher chance of receiving the information.</strong> The rest of the time it
              depends on me.
            </Typography>
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
              data-testid={DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON}
            >
              Continue
            </PrimaryButton>
          </Box>
        </ChatBubble>

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp
            sentAt={
              skillsRankingState.phase[skillsRankingState.phase.length - 1]?.time || skillsRankingState.metadata.started_at
            }
          />
        </ChatMessageFooterLayout>
      </Box>

      <AnimatePresence mode="wait">
        {isTypingVisible && (
          <motion.div
            key="proof-of-value-intro-typing"
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

export default SkillsRankingProofOfValueIntro;
