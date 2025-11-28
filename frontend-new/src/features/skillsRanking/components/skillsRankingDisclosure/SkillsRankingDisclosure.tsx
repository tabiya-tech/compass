import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
  getLatestPhaseName,
} from "src/features/skillsRanking/types";
import { combineWords } from "src/utils/combineWords/combineWords";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { getDefaultTypingDurationMs } from "src/features/skillsRanking/constants";
import { getNextPhaseForGroup } from "src/features/skillsRanking/hooks/skillsRankingFlowGraph";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";

const uniqueId = "67c4908b-b15f-4740-a017-84e509584c10";

export const DATA_TEST_ID = {
  SKILLS_RANKING_DISCLOSURE_CONTAINER: `skills-ranking-disclosure-container-${uniqueId}`,
  SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON: `skills-ranking-disclosure-continue-button-${uniqueId}`,
};

export const SKILLS_RANKING_DISCLOSURE_MESSAGE_ID = `skills-ranking-disclosure-message-${uniqueId}`;

export interface SkillsRankingDisclosureProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

enum ScrollStep {
  INITIAL_TYPING = "INITIAL_TYPING",
  READY_MESSAGE = "READY_MESSAGE",
  TYPING_BEFORE_DISCLOSURE = "TYPING_BEFORE_DISCLOSURE",
  DISCLOSURE = "DISCLOSURE",
  TYPING_AFTER_CONTINUE = "TYPING_AFTER_CONTINUE",
}

const SkillsRankingDisclosure: React.FC<Readonly<SkillsRankingDisclosureProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = currentPhase !== SkillsRankingPhase.DISCLOSURE;
  const group = skillsRankingState.metadata.experiment_group;

  const [submitted, setSubmitted] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);
  const [showInitialTyping, setShowInitialTyping] = useState(!isReplay);
  const [showReadyMessage, setShowReadyMessage] = useState(false);
  const [showTypingBeforeDisclosure, setShowTypingBeforeDisclosure] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const effectStartedRef = useRef(false);

  const currentScrollStep = useMemo(() => {
    if (isTypingVisible) return ScrollStep.TYPING_AFTER_CONTINUE;
    if (showDisclosure) return ScrollStep.DISCLOSURE;
    if (showTypingBeforeDisclosure) return ScrollStep.TYPING_BEFORE_DISCLOSURE;
    if (showReadyMessage) return ScrollStep.READY_MESSAGE;
    if (showInitialTyping) return ScrollStep.INITIAL_TYPING;
    return ScrollStep.INITIAL_TYPING;
  }, [showInitialTyping, showReadyMessage, showTypingBeforeDisclosure, showDisclosure, isTypingVisible]);

  const scrollRef = useAutoScrollOnChange(currentScrollStep);

  // Handle initial sequence: typing -> ready message -> disclosure (Groups 2 & 3)
  // For Group 1: typing -> disclosure (skip ready message)
  useEffect(() => {
    if (isReplay) {
      // In replay mode, show messages immediately
      if (group !== SkillsRankingExperimentGroups.GROUP_1) {
        setShowReadyMessage(true);
      }
      setShowDisclosure(true);
      return;
    }

    // Prevent effect from running multiple times
    if (effectStartedRef.current) {
      return;
    }
    effectStartedRef.current = true;

    const typingDuration = getDefaultTypingDurationMs();
    let timer1: NodeJS.Timeout | null = null;
    let timer2: NodeJS.Timeout | null = null;

    if (group === SkillsRankingExperimentGroups.GROUP_1) {
      // Group 1: Skip ready message, show initial typing then disclosure
      timer1 = setTimeout(() => {
        setShowInitialTyping(false);
        setShowTypingBeforeDisclosure(true);
        timer2 = setTimeout(() => {
          setShowTypingBeforeDisclosure(false);
          setShowDisclosure(true);
        }, typingDuration);
      }, typingDuration);
    } else {
      // Groups 2 & 3: Show typing, then ready message, then typing, then disclosure
      timer1 = setTimeout(() => {
        setShowInitialTyping(false);
        setShowReadyMessage(true);
        timer2 = setTimeout(() => {
          setShowTypingBeforeDisclosure(true);
          setTimeout(() => {
            setShowTypingBeforeDisclosure(false);
            setShowDisclosure(true);
          }, typingDuration);
        }, typingDuration);
      }, typingDuration);
    }

    return () => {
      if (timer1) clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
      effectStartedRef.current = false;
    };
  }, [isReplay, group]);

  const handleContinue = useCallback(async () => {
    if (submitted || isReplay || !isOnline || currentPhase !== SkillsRankingPhase.DISCLOSURE) {
      return;
    }

    setSubmitted(true);
    setIsTypingVisible(true);

    const start = Date.now();
    let newSkillsRankingState: SkillsRankingState | null = null;

    try {
      const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (!activeSessionId) {
        throw new SkillsRankingError("Active session ID is not available.");
      }

      const nextPhase = getNextPhaseForGroup(group, SkillsRankingPhase.DISCLOSURE);
      if (!nextPhase) {
        throw new SkillsRankingError("No next phase found for DISCLOSURE");
      }

      newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        nextPhase
      );
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
      enqueueSnackbar("Failed to update skills ranking state. Please try again later.", { variant: "error" });
      setSubmitted(false);
      setIsTypingVisible(false);
      return;
    }

    const elapsed = Date.now() - start;
    const remaining = Math.max(0, getDefaultTypingDurationMs() - elapsed);

    setTimeout(() => {
      setIsTypingVisible(false);
      if (newSkillsRankingState) {
        onFinish(newSkillsRankingState);
      }
    }, remaining);
  }, [group, onFinish, enqueueSnackbar, submitted, isReplay, isOnline, currentPhase]);

  const renderDisclosureMessage = () => {
    const { score } = skillsRankingState;
    const mostDemandedLabel = score.most_demanded_label;
    const leastDemandedLabel = score.least_demanded_label;
    const aboveAverageLabels = score.above_average_labels;
    const belowAverageLabels = score.below_average_labels;

  switch (group) {
    case SkillsRankingExperimentGroups.GROUP_1:
      return (
          <Typography>
          I've gathered the relevant information, but ran into an error and need to run a few more checks on the
          opportunities listed on SAYouth.mobi to make sure we give you the most accurate and up-to-date details. We'll
          notify you as soon as everything is ready. Please bring this up during our phone survey in a few months if we
            still haven't reached out by then -- we'd be happy to revisit it with you then. Thanks for your patience!
          </Typography>
      );
    case SkillsRankingExperimentGroups.GROUP_2:
      const aboveAverageLabelsWithoutMostGroup2 = aboveAverageLabels.filter(
        (label) => label !== mostDemandedLabel
      );
      return (
          <Typography component="div" sx={{ display: "flex", flexDirection: "column", gap: theme.spacing(4) }}>
            <Typography component="div">
            Important: To get this information, we looked at a random sample of the opportunities (about 1 out of every
            3) from the last 6 months in your province.
            </Typography>
            <Typography component="div">
              Because this is a sample and not all the opportunities, <strong>it gives a good signal, but it is not a 100% complete picture.</strong>
            </Typography>
            <Typography component="div">In that data sample, here is what we found:</Typography>
            <Typography component="div" sx={{ backgroundColor: theme.palette.success.light }}>
              <strong>&#9650;&#9650; {mostDemandedLabel} is 'above average' in demand</strong>, and the <strong>most demanded</strong> of your skill areas.
            </Typography>
            {aboveAverageLabelsWithoutMostGroup2.length > 0 && (
              <Typography component="div" sx={{ backgroundColor: theme.palette.success.light }}>
                <strong>&#9650; {combineWords(aboveAverageLabelsWithoutMostGroup2)} is also 'above average'</strong> in demand.
              </Typography>
            )}
          </Typography>
      );
    case SkillsRankingExperimentGroups.GROUP_3:
      const belowAverageLabelsWithoutLeast = belowAverageLabels.filter(
        (label) => label !== leastDemandedLabel
      );
      const aboveAverageLabelsWithoutMost = aboveAverageLabels.filter(
        (label) => label !== mostDemandedLabel
      );
      return (
          <Typography component="div" sx={{ display: "flex", flexDirection: "column", gap: theme.spacing(4) }}>
            <Typography component="div">
          Important: To get this information, we looked at a random sample of the opportunities (about 1 out of every 3)
          from the last 6 months in your province.
            </Typography>
            <Typography component="div">
              Because this is a sample and not all the opportunities, <strong>it gives a good signal, but it is not a 100% complete picture.</strong>
          </Typography>
            <Typography component="div">In that data sample, here is what we found:</Typography>
            <Typography component="div">
              <Typography component="span" sx={{ backgroundColor: theme.palette.error.light }}>
              &#9660;&#9660; <strong>{leastDemandedLabel}</strong> is <strong>'below average'</strong> in demand, and the <strong>'least demanded'</strong> of your skill
              areas.
            </Typography>
          </Typography>
            {belowAverageLabelsWithoutLeast.length > 0 && (
              <Typography component="div">
                <Typography component="span" sx={{ backgroundColor: theme.palette.error.light }}>
                &#9660; <strong>{combineWords(belowAverageLabelsWithoutLeast)}</strong> are also <strong>'below average'</strong> in demand.
              </Typography>
            </Typography>
            )}
            <Typography component="div">
              <Typography component="span" sx={{ backgroundColor: theme.palette.success.light }}>
              &#9650;&#9650; <strong>{mostDemandedLabel}</strong> is <strong>'above average'</strong> in demand, and the <strong>'most demanded'</strong> of your skill
              areas.
            </Typography>
          </Typography>
            {aboveAverageLabelsWithoutMost.length > 0 && (
              <Typography component="div">
                <Typography component="span" sx={{ backgroundColor: theme.palette.success.light }}>
                  <strong>&#9650; {combineWords(aboveAverageLabelsWithoutMost)}</strong> is also <strong>'above average'</strong> in demand.
                </Typography>
              </Typography>
            )}
          </Typography>
      );
    default:
      return null;
  }
};

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTAINER}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      {/* Initial typing animation */}
      <AnimatePresence mode="wait">
        {showInitialTyping && (
          <motion.div
            key="initial-typing"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TypingChatMessage />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ready message - shown once for Groups 2 & 3 */}
      {showReadyMessage && (
        <Box sx={{ width: "100%" }}>
          <ChatBubble sender={ConversationMessageSender.COMPASS} message={<Typography>Great, the information is now ready:</Typography>} />
          <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
            <Timestamp sentAt={skillsRankingState.phase.at(-1)?.time || skillsRankingState.metadata.started_at} />
          </ChatMessageFooterLayout>
        </Box>
      )}

      {/* Typing animation before disclosure */}
      <AnimatePresence mode="wait">
        {showTypingBeforeDisclosure && (
          <motion.div
            key="typing-before-disclosure"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TypingChatMessage />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disclosure message with continue button */}
      {showDisclosure && (
      <Box sx={{ width: "100%" }}>
          <ChatBubble sender={ConversationMessageSender.COMPASS} message={renderDisclosureMessage()}>
            <Box
              display="flex"
              flexDirection="row"
              justifyContent="flex-end"
              padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
            >
              <PrimaryButton
                onClick={handleContinue}
                disabled={isReplay || !isOnline || submitted || isTypingVisible || currentPhase !== SkillsRankingPhase.DISCLOSURE}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON}
              >
                Continue
              </PrimaryButton>
            </Box>
        </ChatBubble>
        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
            <Timestamp
              sentAt={skillsRankingState.phase.at(-1)?.time || skillsRankingState.metadata.started_at}
            />
        </ChatMessageFooterLayout>
      </Box>
      )}

      {/* Final typing animation after continue is clicked */}
      <AnimatePresence mode="wait">
        {isTypingVisible && (
          <motion.div
            key="typing-after-continue"
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

export default SkillsRankingDisclosure;
