import React, { useEffect, useState, useMemo, useRef } from "react";
import { Box, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { SkillsRankingState, SkillsRankingPhase } from "src/features/skillsRanking/types";
import { getLatestPhaseName } from "src/features/skillsRanking/types";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { getDefaultTypingDurationMs } from "src/features/skillsRanking/constants";
import { shouldSkipMarketDisclosure } from "src/features/skillsRanking/utils/createMessages";

const uniqueId = "b6492d47-2685-4af7-baa0-5279606aa05f";

enum CompletionAdviceStep {
  SHOW_ADVICE = 0,
  SHOW_TYPING = 1,
  COMPLETED = 2,
}

const ADVICE_SHOWN_DURATION_MS = 5000; // Duration to show the advice before typing starts

export const DATA_TEST_ID = {
  SKILLS_RANKING_COMPLETION_ADVICE_CONTAINER: `skills-ranking-completion-advice-container-${uniqueId}`,
};

export const SKILLS_RANKING_COMPLETION_ADVICE_MESSAGE_ID = `skills-ranking-completion-advice-message-${uniqueId}`;

export interface SkillsRankingCompletionAdviceProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingCompletionAdvice: React.FC<Readonly<SkillsRankingCompletionAdviceProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const componentShown = useRef(false);

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = useMemo(() => currentPhase === SkillsRankingPhase.COMPLETED, [currentPhase]);

  const [step, setStep] = useState<CompletionAdviceStep>(CompletionAdviceStep.SHOW_ADVICE);

  useEffect(() => {
    if (componentShown.current) {
      return;
    }

    componentShown.current = true;

    // Don't run the effect if we're in replay mode
    if (isReplay) {
      setStep(CompletionAdviceStep.COMPLETED);
      onFinish(skillsRankingState).then();
      return;
    }

    // Show typing message after a delay, then call onFinish
    const timeout = setTimeout(() => {
      setStep(CompletionAdviceStep.SHOW_TYPING);

      // After typing duration, call onFinish to end the flow
      const finishTimeout = setTimeout(() => {
        setStep(CompletionAdviceStep.COMPLETED);
        onFinish(skillsRankingState).then();
      }, getDefaultTypingDurationMs());

      return () => clearTimeout(finishTimeout);
    }, ADVICE_SHOWN_DURATION_MS); // Show advice for 5 seconds before typing

    return () => clearTimeout(timeout);
  }, [onFinish, skillsRankingState, isReplay]);

  if (shouldSkipMarketDisclosure(skillsRankingState.experiment_group)) {
    return <></>;
  }

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_COMPLETION_ADVICE_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble
          message={
            <>
              Some advice: These numbers are for you. How might these numbers change the way you look for roles this
              week? Pause and consider where your time and energy now feel best spent in your strategy to find a job.
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

      {/* Typing message shown after advice */}
      <AnimatePresence mode="wait">
        {step === CompletionAdviceStep.SHOW_TYPING && (
          <motion.div
            key="completion-typing"
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

export default SkillsRankingCompletionAdvice;
