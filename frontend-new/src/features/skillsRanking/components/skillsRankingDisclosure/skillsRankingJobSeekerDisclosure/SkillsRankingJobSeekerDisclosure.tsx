import React, { useEffect, useState, useCallback } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { jobSeekerComparisonLabels } from "src/features/skillsRanking/components/skillsRankingDisclosure/types";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";

const DISPLAY_TIMEOUT = 5000;

const uniqueId = "9b0dbc80-c786-4c24-ba9d-04b6946fa0b9";
export const DATA_TEST_ID = {
  SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_CONTAINER: `skills-ranking-job-seeker-disclosure-container-${uniqueId}`,
};

export const SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_MESSAGE_ID = `skills-ranking-job-seeker-disclosure-message-${uniqueId}`;

export interface SkillsRankingJobSeekerDisclosureProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingJobSeekerDisclosure: React.FC<Readonly<SkillsRankingJobSeekerDisclosureProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const selectedLabel = skillsRankingState.score.comparison_label;
  const selectedIndex = jobSeekerComparisonLabels.findIndex(
    (label) => label === selectedLabel
  );

  const activeSessionId =
    UserPreferencesStateService.getInstance().getActiveSessionId();
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = skillsRankingState.phase[skillsRankingState.phase.length - 1]?.name;
  const isReplay = currentPhase !== SkillsRankingPhase.JOB_SEEKER_DISCLOSURE;
  const [step, setStep] = useState(0);
  const [hasFinished, setHasFinished] = useState(false);
  const scrollRef = useAutoScrollOnChange(step);

  const handleContinue = useCallback(async () => {
    if (currentPhase !== SkillsRankingPhase.JOB_SEEKER_DISCLOSURE) {
      console.error(
        new SkillsRankingError(
          "SkillsRankingJobSeekerDisclosure: handleContinue called in non-JOB_SEEKER_DISCLOSURE phase."
        )
      );
      return;
    }

    if (!activeSessionId) {
      throw new SkillsRankingError("Active session ID is not available.");
    }

    try {
      const newSkillsRankingState =
        await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          SkillsRankingPhase.PERCEIVED_RANK
        );
      await onFinish(newSkillsRankingState);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
      enqueueSnackbar(
        "Failed to update skills ranking state. Please try again later.",
        { variant: "error" }
      );
    }
  }, [
    currentPhase,
    activeSessionId,
    onFinish,
    enqueueSnackbar,
  ]);

  useEffect(() => {
    if (isReplay || hasFinished) return;

    const timers: NodeJS.Timeout[] = [];

    if (step === 0) {
      timers.push(setTimeout(() => setStep(1), DISPLAY_TIMEOUT));
    } else if (step === 1) {
      timers.push(setTimeout(() => setStep(2), DISPLAY_TIMEOUT));
    } else if (step === 2) {
        if (!hasFinished) {
          setHasFinished(true);
          handleContinue().then();
        }
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [step, isReplay, hasFinished, handleContinue]);

  const renderGroupMessage = () => {
    const isGroupUndisclosed =
      skillsRankingState.experiment_group ===
        SkillsRankingExperimentGroups.GROUP_2 ||
      skillsRankingState.experiment_group ===
        SkillsRankingExperimentGroups.GROUP_4;

    if (isGroupUndisclosed) {
      return (
        <ChatBubble
          sender={ConversationMessageSender.COMPASS}
          message={`We've gathered the relevant information, but we need to run a few more checks on the opportunities listed on SAYouth.mobi to make sure we give you the most accurate and up-to-date details. We'll notify you as soon as everything is ready. In the meantime, feel free to bring this up during our next phone survey -- we'd be happy to revisit it with you then. Thanks for your patience!`}
        />
      );
    }

    return (
      <ChatBubble
        sender={ConversationMessageSender.COMPASS}
        message={`Compared to job seekers similar to you, you are in the [${selectedLabel}] group out of five. This means that when we rank 100 people from lowest to highest, and create five equal size groups, the first group are the 20 people fitting most jobs, and the fifth group are the people fitting fewer jobs on the platform than the other 80.`}
      >
        <Box mt={theme.spacing(4)} px={2}>
          {/* Labels */}
          <Box display="flex" justifyContent="space-between" mb={1}>
            {jobSeekerComparisonLabels.map((label, idx) => (
              <Box
                key={label}
                flex={1}
                textAlign="center"
                justifyContent={"center"}
                px={0.5}
                height={theme.fixedSpacing(theme.tabiyaSpacing.xl * 2)}
              >
                <Box
                  py={0.5}
                  px={1}
                  sx={{
                    height: "100%",
                    borderRadius: 1,
                    fontWeight: "bold",
                    backgroundColor:
                      idx === selectedIndex
                        ? theme.palette.success.main
                        : theme.palette.grey[200],
                    color: "black",
                    fontSize: "0.75rem",
                    whiteSpace: "wrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textAlign: "center",
                    justifyContent: "center",
                    display: "flex",
                    alignContent: "center",
                    flexWrap: "wrap",
                    flexDirection: "row",
                  }}
                >
                  {label}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Percentage Bar */}
          <Box display="flex" height={12} borderRadius={2} overflow="hidden">
            {[0, 1, 2, 3, 4].map((idx) => (
              <Box
                key={idx}
                flex={1}
                sx={{
                  backgroundColor:
                    idx === selectedIndex
                      ? theme.palette.success.main
                      : theme.palette.grey[200],
                  transition: "background-color 0.3s ease",
                }}
              />
            ))}
          </Box>

          {/* Percentage ticks */}
          <Box display="flex" justifyContent="space-between" mt={1}>
            {[0, 20, 40, 60, 80, 100].map((pct) => (
              <Typography key={pct} variant="caption">
                {pct}%
              </Typography>
            ))}
          </Box>
        </Box>
      </ChatBubble>
    );
  };

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_CONTAINER}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
    >
      <Box sx={{ width: "100%" }}>
        {renderGroupMessage()}

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp sentAt={skillsRankingState.phase[skillsRankingState.phase.length - 1]?.time || skillsRankingState.started_at} />
        </ChatMessageFooterLayout>
      </Box>

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
