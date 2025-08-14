import React, { useCallback, useEffect, useState } from "react";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { SkillsRankingPhase, SkillsRankingState, getLatestPhaseName } from "src/features/skillsRanking/types";
import { getCompensationAmount } from "src/features/skillsRanking/constants";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { Box } from "@mui/material";
import { getDefaultTypingDurationMs, MESSAGE_DURATION_MS } from "src/features/skillsRanking/constants";

const uniqueId = "1e13ec58-2931-47ef-b1a9-30550519707b";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PROMPT_CONTAINER: `skills-ranking-prompt-container-${uniqueId}`,
  REPLAY_CONTAINER: `skills-ranking-prompt-replay-container-${uniqueId}`,
  MAIN_MESSAGE_CONTAINER: `skills-ranking-prompt-main-message-${uniqueId}`,
};

export const SKILLS_RANKING_PROMPT_MESSAGE_ID = `skills-ranking-prompt-message-${uniqueId}`;

enum PromptStep {
  INITIAL_TYPING = 0,
  SHOW_MESSAGE = 1,
  FINAL_TYPING = 2,
  COMPLETED = 3,
}

export interface SkillsRankingPromptProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingPrompt: React.FC<Readonly<SkillsRankingPromptProps>> = ({ onFinish, skillsRankingState }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [step, setStep] = useState<PromptStep>(PromptStep.INITIAL_TYPING);
  const scrollRef = useAutoScrollOnChange(step);

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = currentPhase !== SkillsRankingPhase.INITIAL;

  const compensationAmount = getCompensationAmount();

  const handleAdvanceState = useCallback(async () => {
    if (isReplay) return;
    const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!activeSessionId) {
      throw new SkillsRankingError("Active session ID is not available.");
    }
    try {
      const newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.BRIEFING
      );
      await onFinish(newSkillsRankingState);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
      enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
        variant: "error",
      });
    }
  }, [isReplay, onFinish, enqueueSnackbar]);

  useEffect(() => {
    if (isReplay) return;

    let timeoutId: NodeJS.Timeout;

    if (step === PromptStep.INITIAL_TYPING) {
      timeoutId = setTimeout(() => setStep(PromptStep.SHOW_MESSAGE), getDefaultTypingDurationMs());
    } else if (step === PromptStep.SHOW_MESSAGE) {
      timeoutId = setTimeout(() => setStep(PromptStep.FINAL_TYPING), MESSAGE_DURATION_MS);
    } else if (step === PromptStep.FINAL_TYPING) {
      timeoutId = setTimeout(() => {
        setStep(PromptStep.COMPLETED);
        handleAdvanceState().then();
      }, getDefaultTypingDurationMs());
    }

    return () => clearTimeout(timeoutId);
  }, [step, isReplay, handleAdvanceState]);

  const PromptMessage = () => {
    return (
      <ChatBubble
        message={
          <>
            <strong>Almost done!</strong> Answer a few more research questions and we’ll send you{" "}
            <strong>{compensationAmount} </strong> airtime once you have completed all tasks.
          </>
        }
        sender={ConversationMessageSender.COMPASS}
      />
    );
  };

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
      ref={scrollRef}
    >
      {isReplay ? (
        <Box sx={{ width: "100%" }} data-testid={DATA_TEST_ID.REPLAY_CONTAINER}>
          <PromptMessage />
          <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
            <Timestamp
              sentAt={
                skillsRankingState.phases[skillsRankingState.phases.length - 1]?.time || skillsRankingState.started_at
              }
            />
          </ChatMessageFooterLayout>
        </Box>
      ) : (
        <>
          <AnimatePresence mode="wait">
            {step === PromptStep.INITIAL_TYPING && (
              <motion.div
                key="typing-1"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <TypingChatMessage />
              </motion.div>
            )}
          </AnimatePresence>

          {step >= 1 && (
            <motion.div
              key="main-message"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: step === PromptStep.SHOW_MESSAGE ? 0.3 : 0 }}
            >
              <Box sx={{ width: "100%" }} data-testid={DATA_TEST_ID.MAIN_MESSAGE_CONTAINER}>
                <PromptMessage />
                <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
                  <Timestamp
                    sentAt={
                      skillsRankingState.phases[skillsRankingState.phases.length - 1]?.time ||
                      skillsRankingState.started_at
                    }
                  />
                </ChatMessageFooterLayout>
              </Box>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {step === PromptStep.FINAL_TYPING && (
              <motion.div
                key="typing-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <TypingChatMessage />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </MessageContainer>
  );
};

export default SkillsRankingPrompt;
