import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { getLatestPhaseName, SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
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
import { getDefaultTypingDurationMs, getJobPlatformUrl } from "src/features/skillsRanking/constants";
import { shouldSkipMarketDisclosure } from "src/features/skillsRanking/utils/createMessages";

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
  const selectedIndex = jobSeekerComparisonLabels.findIndex((label) => label === selectedLabel);

  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = currentPhase !== SkillsRankingPhase.JOB_SEEKER_DISCLOSURE;
  const [showTyping, setShowTyping] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const scrollRef = useAutoScrollOnChange(showTyping);

  const handleContinue = useCallback(async () => {
    if (currentPhase !== SkillsRankingPhase.JOB_SEEKER_DISCLOSURE) {
      console.error(
        new SkillsRankingError(
          "SkillsRankingJobSeekerDisclosure: handleContinue called in non-JOB_SEEKER_DISCLOSURE phase."
        )
      );
      return;
    }

    const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!activeSessionId) {
      throw new SkillsRankingError("Active session ID is not available.");
    }

    try {
      const newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.PERCEIVED_RANK
      );
      await onFinish(newSkillsRankingState);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
      enqueueSnackbar("Failed to update skills ranking state. Please try again later.", { variant: "error" });
    }
  }, [currentPhase, onFinish, enqueueSnackbar]);

  useEffect(() => {
    if (isReplay || hasFinished) return;

    const timer = setTimeout(() => {
      setShowTyping(true);
      setTimeout(() => {
        setShowTyping(false);
        if (!hasFinished) {
          setHasFinished(true);
          handleContinue().then();
        }
      }, getDefaultTypingDurationMs());
    }, getDefaultTypingDurationMs());

    return () => clearTimeout(timer);
  }, [isReplay, hasFinished, handleContinue]);
  const isGroupUndisclosed = useMemo(
    () => shouldSkipMarketDisclosure(skillsRankingState.experiment_group),
    [skillsRankingState.experiment_group]
  );

  const renderGroupMessage = () => {
    if (isGroupUndisclosed) {
      return (
        <ChatBubble
          sender={ConversationMessageSender.COMPASS}
          message={
            <>
              Thanks! We’re double-checking the latest {getJobPlatformUrl()} opportunities so the numbers are accurate.
              We’ll share your results soon or you can ask for them when we call you for the phone survey.
            </>
          }
        />
      );
    }

    return (
      <ChatBubble
        sender={ConversationMessageSender.COMPASS}
        message={
          <>
            Moreover,{" "}
            <strong>
              Compared to other {getJobPlatformUrl()} users, you are in group [
              {jobSeekerComparisonLabels.indexOf(selectedLabel) + 1}] of {jobSeekerComparisonLabels.length}.
            </strong>
            <br />
            Imagine lining up 100 {getJobPlatformUrl()} users from the fewest to the most jobs they fit. We cut the line
            into five blocks of 20 people. Block 1 (highest 20) fit the most jobs; block 5 (lowest 20) fit the fewest.
            You’re in block <strong>[{jobSeekerComparisonLabels.indexOf(selectedLabel) + 1}]</strong>, which is the{" "}
            <strong>[{selectedLabel}]</strong> block.
            <br />
          </>
        }
      >
        <Box padding={theme.spacing(theme.tabiyaSpacing.lg)} paddingBottom={theme.spacing(theme.tabiyaSpacing.xl)}>
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
                    backgroundColor: idx === selectedIndex ? theme.palette.primary.main : theme.palette.grey[200],
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
                  backgroundColor: idx === selectedIndex ? theme.palette.success.main : theme.palette.grey[200],
                  transition: "background-color 0.3s ease",
                }}
              />
            ))}
          </Box>

          {/* Percentage ticks - positioned at segment boundaries */}
          <Box display="flex" mt={1} position="relative">
            {[0, 20, 40, 60, 80, 100].map((pct, index) => (
              <Typography
                key={pct}
                variant="caption"
                sx={{
                  position: "absolute",
                  left: `${(index / 5) * 100}%`,
                  // move the 100% text to the left to keep it in a position where it is aligned to the right of the bar
                  transform: index === 0 ? "translateX(0)" : index === 5 ? "translateX(-100%)" : "translateX(-50%)",
                  whiteSpace: "nowrap",
                }}
              >
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
          <Timestamp
            sentAt={
              skillsRankingState.phases[skillsRankingState.phases.length - 1]?.time || skillsRankingState.started_at
            }
          />
        </ChatMessageFooterLayout>
      </Box>

      <AnimatePresence mode="wait">
        {showTyping && (
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
