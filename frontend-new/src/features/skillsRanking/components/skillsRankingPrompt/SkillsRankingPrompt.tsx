import React, { useEffect, useMemo, useState, useCallback } from "react";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";

const TYPING_DURATION_MS = 2000;
const MESSAGE_DURATION_MS = 5000;

const uniqueId = "1e13ec58-2931-47ef-b1a9-30550519707b";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PROMPT_CONTAINER: `skills-ranking-prompt-container-${uniqueId}`,
};

export const SKILLS_RANKING_PROMPT_MESSAGE_ID = `skills-ranking-prompt-message-${uniqueId}`;

export interface SkillsRankingPromptProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingPrompt: React.FC<Readonly<SkillsRankingPromptProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

  const [step, setStep] = useState(0);
  const scrollRef = useAutoScrollOnChange(step);

  const isReplay = skillsRankingState.phase !== SkillsRankingPhase.INITIAL;

  const airtime_amount = useMemo(
    () => SkillsRankingService.getInstance().getConfig().config.airtimeBudget,
    []
  );

  const handleAdvanceState = useCallback(async () => {
    if (isReplay) return;
    if (!activeSessionId) {
      throw new SkillsRankingError("Active session ID is not available.");
    }
    try {
      const newSkillsRankingState =
        await SkillsRankingService.getInstance().updateSkillsRankingState(
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
  }, [isReplay, activeSessionId, onFinish, enqueueSnackbar]);

  useEffect(() => {
    if (isReplay) return;

    let timeoutId: NodeJS.Timeout;

    if (step === 0) {
      timeoutId = setTimeout(() => setStep(1), TYPING_DURATION_MS);
    } else if (step === 1) {
      timeoutId = setTimeout(() => setStep(2), MESSAGE_DURATION_MS);
    } else if (step === 2) {
      timeoutId = setTimeout(() => {
        setStep(3); // done
        handleAdvanceState().then();
      }, TYPING_DURATION_MS);
    }

    return () => clearTimeout(timeoutId);
  }, [step, isReplay, handleAdvanceState]);

  const PromptMessage = () => {
    return (
      <ChatBubble
        message={`You are almost there! Remember that if you completely finish this conversation with me you will receive ${airtime_amount} Rand in airtime.`}
        sender={ConversationMessageSender.COMPASS}
      />
    );
  }

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PROMPT_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
      ref={scrollRef}
    >
      {isReplay ? (
        <PromptMessage/>
      ) : (
        <>
          <AnimatePresence mode="wait">
            {step === 0 && (
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
              transition={{ duration: 0.4, ease: "easeOut", delay: step === 1 ? 0.3 : 0 }}
            >
              <PromptMessage/>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {step === 2 && (
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
