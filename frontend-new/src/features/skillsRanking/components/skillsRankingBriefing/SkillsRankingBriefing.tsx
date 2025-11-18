import React, { useCallback, useContext, useMemo, useState } from "react";
import { Box, useTheme } from "@mui/material";
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
  SKILLS_RANKING_BRIEFING_FIRST_CONTINUE_BUTTON: `skills-ranking-briefing-first-continue-button-${uniqueId}`,
  SKILLS_RANKING_BRIEFING_SECOND_CONTINUE_BUTTON: `skills-ranking-briefing-second-continue-button-${uniqueId}`,
};

enum ScrollStep {
  INITIAL = 0,
  TYPING = 1,
  SECOND_MESSAGE = 2,
}

const getBriefingMessage = (group: SkillsRankingExperimentGroups): JSX.Element => {
  const jobPlatform = getJobPlatformUrl();

  switch (group) {
    case SkillsRankingExperimentGroups.GROUP_1:
      return (
        <>
          If you are interested,{" "}
          <strong>I can show you information on which skill areas employers ask for on {jobPlatform}.</strong> Here is
          what I mean with this:
          <br />
          <br /> On {jobPlatform}, some skill areas are asked for in many opportunities, and some are asked for in few.
          I can give you some information on these trends. <br />
          <br />
          Calculating this will take some time. When you are ready please click continue. If you are not interested, you
          will be given a chance to cancel.
        </>
      );

    case SkillsRankingExperimentGroups.GROUP_2:
      return (
        <>
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
        </>
      );

    case SkillsRankingExperimentGroups.GROUP_3:
      return (
        <>
          If you are interested,{" "}
          <strong>
            I can show you information about which of your skill areas are 'above average' in demand on {jobPlatform}.
          </strong>{" "}
          Here is what I mean with this:
          <br />
          <br /> On {jobPlatform}, some skill areas are asked for in many opportunities, and some are asked for in few.
          I calculate the average demand for the skill areas you have. A skill area is 'below average' in demand if it
          is asked for in fewer opportunities than the average skill area. It is 'above average' if it is asked for in
          more opportunities than average.
          <br />
          <br />
          Calculating this will take some time. When you are ready please click continue. If you are not interested, you
          will be given a chance to cancel.
        </>
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

  const [firstButtonSubmitted, setFirstButtonSubmitted] = useState(false);
  const [secondButtonSubmitted, setSecondButtonSubmitted] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);
  const [showSecondMessage, setShowSecondMessage] = useState(isReplay);

  const currentScrollStep = useMemo(() => {
    if (isTypingVisible) return ScrollStep.TYPING;
    if (showSecondMessage) return ScrollStep.SECOND_MESSAGE;
    return ScrollStep.INITIAL;
  }, [isTypingVisible, showSecondMessage]);

  const scrollRef = useAutoScrollOnChange(currentScrollStep);

  const handleFirstContinue = useCallback(() => {
    setFirstButtonSubmitted(true);
    setIsTypingVisible(true);

    setTimeout(() => {
      setIsTypingVisible(false);
      setShowSecondMessage(true);
    }, getDefaultTypingDurationMs());
  }, []);

  const handleSecondContinue = useCallback(async () => {
    setSecondButtonSubmitted(true);
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
      setSecondButtonSubmitted(false);
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
          message={getBriefingMessage(skillsRankingState.experiment_group)}
          sender={ConversationMessageSender.COMPASS}
        >
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="flex-end"
            padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
          >
            <PrimaryButton
              onClick={handleFirstContinue}
              disabled={isReplay || !isOnline || firstButtonSubmitted || isTypingVisible || showSecondMessage}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_BRIEFING_FIRST_CONTINUE_BUTTON}
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

      {showSecondMessage && (
        <Box sx={{ width: "100%" }}>
          <ChatBubble
            message={
              <>
                You'll see tilted letters on a few screens. Turn each letter upright using the rotation buttons. You can
                cancel anytime. In 5% of cases,{" "}
                <strong>more letters fixed = higher chance of receiving the information.</strong> The rest of the time
                it depends on me.
              </>
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
                onClick={handleSecondContinue}
                disabled={isReplay || !isOnline || secondButtonSubmitted || isTypingVisible}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_BRIEFING_SECOND_CONTINUE_BUTTON}
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
