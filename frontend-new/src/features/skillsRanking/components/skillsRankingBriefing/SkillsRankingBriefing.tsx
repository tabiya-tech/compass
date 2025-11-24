import React, { useCallback, useContext, useState, useMemo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
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
}

const getBriefingMessage = (group: SkillsRankingExperimentGroups): JSX.Element => {
  const jobPlatform = getJobPlatformUrl();

  switch (group) {
    case SkillsRankingExperimentGroups.GROUP_1:
      return (
        <Typography>
          If you are interested, <strong>I can show you information on which skill areas employers ask for on {jobPlatform}.</strong>
          <br />
          <br /> <strong>Here's what I mean:</strong> {jobPlatform}, some skill areas are asked for in many opportunities, and some are asked for in few.
          I can give you some information on these trends. <br />
          <br />
          Calculating this will take some time. When you are ready please click continue. <strong>If you are not interested, you
          will be given a chance to cancel.</strong>
        </Typography>
      );

    case SkillsRankingExperimentGroups.GROUP_2:
      return (
        <Typography>
          If you are interested,{" "}
          <strong>
            I can show you information about which of your skill areas are 'above average' in demand on {jobPlatform}.
          </strong>{" "}
          Here is what I mean with this:
          <br />
          <br /> On {jobPlatform}, some skill areas are asked for in many opportunities, and some are asked for in few.
          I calculate the average demand for the skill areas you have. A skill area is 'above average' in demand if it
          is asked for in more opportunities than the average skill area.
          <br />
          <br />
          Calculating this will take some time. When you are ready please click continue. If you are not interested, you
          will be given a chance to cancel.
        </Typography>
      );

    case SkillsRankingExperimentGroups.GROUP_3:
      return (
        <Typography>
          If you are interested,{" "}
          <strong>
            I can show you information about which of your skill areas are 'below average', and which are 'above average'
            in demand on {jobPlatform}
          </strong>
          . Here is what I mean:
          <br />
          <br /> On {jobPlatform}, some skill areas are asked for in many opportunities, and some are asked for in few. I
          calculate the average demand for the skill areas you have. A skill area is 'below average' in demand if it is
          asked for in fewer opportunities than the average skill area. It is 'above average' if it is asked for in more
          opportunities than average.
          <br />
          <br />
          Calculating this will take some time. When you are ready please click continue. If you are not interested, you
          will be given a chance to cancel.
        </Typography>
      );

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
        console.error(new SkillsRankingError("No session ID."));
        return;
      }

      newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.PROOF_OF_VALUE_INTRO
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
        <ChatBubble
          message={getBriefingMessage(skillsRankingState.metadata.experiment_group)}
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
              skillsRankingState.phase[skillsRankingState.phase.length - 1]?.time || skillsRankingState.metadata.started_at
            }
          />
        </ChatMessageFooterLayout>
      </Box>

      {/* Typing shown after clicking continue */}
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
