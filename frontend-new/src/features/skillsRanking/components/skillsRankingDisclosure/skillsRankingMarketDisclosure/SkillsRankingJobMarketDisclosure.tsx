import React, { useEffect, useMemo, useState } from "react";

import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import { useTheme } from "@mui/material/styles";

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

const SkillsRankingJobSeekerDisclosure: React.FC<SkillsRankingJobMarketDisclosureProps> = ({
  onFinish,
  skillsRankingState,
}) => {
  const [step, setStep] = useState(0); // 0: message, 1: typing, 2: done
  const scrollRef = useAutoScrollOnChange(step);
  const theme = useTheme();

  const isReplay = useMemo(() => skillsRankingState.phase !== SkillsRankingPhase.MARKET_DISCLOSURE, [skillsRankingState.phase]);
  const isImmediateFinishGroup =
    skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_2 ||
    skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_4;

  const jobPlatformUrl = useMemo(
    () => SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl,
    []
  );

  useEffect(() => {
    if (isImmediateFinishGroup) {
      onFinish(skillsRankingState);
    }
  }, [isImmediateFinishGroup, onFinish, skillsRankingState]);

  useEffect(() => {
    if (isReplay || isImmediateFinishGroup) return;

    if (step === 0) {
      const t = setTimeout(() => setStep(1), TYPING_DURATION_MS);
      return () => clearTimeout(t);
    } else if (step === 1) {
      const t = setTimeout(() => {
        setStep(2);
        onFinish(skillsRankingState);
      }, TYPING_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [step, isReplay, isImmediateFinishGroup, onFinish, skillsRankingState]);

  if (isImmediateFinishGroup) return null;

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_JOB_MARKET_DISCLOSURE_CONTAINER}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <ChatBubble
        message={`With your current skillset you fulfill the required & most relevant skills of ${skillsRankingState.score.jobs_matching_rank}% of jobs on ${jobPlatformUrl}. This is quite some jobs!`}
        sender={ConversationMessageSender.COMPASS}
      />

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

export default SkillsRankingJobSeekerDisclosure;
