import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingPhase,
  SkillsRankingState,
  getLatestPhaseName,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { getJobPlatformUrl } from "src/features/skillsRanking/constants";
import SkillsRankingSlider from "src/features/skillsRanking/components/skillsRankingSlider/SkillsRankingSlider";
import { shouldSkipMarketDisclosure } from "src/features/skillsRanking/utils/createMessages";

const uniqueId = "eb90de4c-2462-4b6d-8b9c-1b5c6ae64129";
const TYPING_DURATION_MS = 5000;

export const DATA_TEST_ID = {
  SKILLS_RANKING_RETYPED_RANK_CONTAINER: `skills-ranking-retyped-rank-container-${uniqueId}`,
  SKILLS_RANKING_RETYPED_RANK_SLIDER: `skills-ranking-retyped-rank-slider-${uniqueId}`,
  SKILLS_RANKING_RETYPED_RANK_SUBMIT_BUTTON: `skills-ranking-retyped-rank-submit-button-${uniqueId}`,
};

export interface SkillsRankingRetypedRankProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

export const SKILLS_RANKING_RETYPED_RANK_MESSAGE_ID = `skills-ranking-retyped-rank-message-${uniqueId}`;

const SkillsRankingRetypedRank: React.FC<Readonly<SkillsRankingRetypedRankProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const [value, setValue] = useState(0);
  const [startedEditing, setStartedEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const hasFinishedRef = useRef(false);

  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const scrollRef = useAutoScrollOnChange(showTyping);

  // Use the utility function instead of local variable
  const shouldNotShow = shouldSkipMarketDisclosure(skillsRankingState.experiment_group);

  const handleUpdateState = useCallback(async () => {
    if (!activeSessionId) {
      console.error(new SkillsRankingError("Active session ID is not available."));
      return;
    }
    try {
      const newState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.COMPLETED,
        undefined,
        value
      );
      setSubmitted(true);
      setShowTyping(true);
      setTimeout(() => setShowTyping(false), TYPING_DURATION_MS);
      setTimeout(() => {
        if (!hasFinishedRef.current) {
          hasFinishedRef.current = true;
          onFinish(newState);
        }
      }, TYPING_DURATION_MS + 300);
    } catch (err) {
      console.error("Failed to update state:", err);
      enqueueSnackbar("Something went wrong. Please try again.", { variant: "error" });
    }
  }, [activeSessionId, value, onFinish, enqueueSnackbar]);

  const handleSubmit = async () => {
    if (!submitted && currentPhase === SkillsRankingPhase.RETYPED_RANK) {
      await handleUpdateState();
    }
  };

  useEffect(() => {
    if (currentPhase !== SkillsRankingPhase.RETYPED_RANK) {
      setValue(skillsRankingState.retyped_rank_percentile ?? 0);
    }
  }, [skillsRankingState, currentPhase]);

  useEffect(() => {
    if (shouldNotShow && !hasFinishedRef.current) {
      setShowTyping(true); // Show typing animation
      const typingTimer = setTimeout(async () => {
        if (!activeSessionId) {
          console.error(new SkillsRankingError("Active session ID is not available."));
          return;
        }

        if (currentPhase !== SkillsRankingPhase.RETYPED_RANK) {
          console.warn(`[RetypedRank] Skipping auto-submit. Phase is already ${currentPhase}`);
          return;
        }

        hasFinishedRef.current = true;
        try {
          const newState = await SkillsRankingService.getInstance().updateSkillsRankingState(
            activeSessionId,
            SkillsRankingPhase.COMPLETED,
            undefined,
            value
          );
          await onFinish(newState);
        } catch (err) {
          console.error("Failed to update state:", err);
          enqueueSnackbar("Something went wrong. Please try again.", { variant: "error" });
        }
      }, TYPING_DURATION_MS);

      return () => clearTimeout(typingTimer);
    }
  }, [shouldNotShow, activeSessionId, currentPhase, value, onFinish, enqueueSnackbar]);

  if (shouldNotShow) return <></>;

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      ref={scrollRef}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      {!shouldNotShow && (
        <Box sx={{ width: "100%" }}>
          <ChatBubble
            sender={ConversationMessageSender.COMPASS}
            message={
              <>
                In any case, if we do not think about other job seekers but again focus on those opportunities available
                to you, let's move to creating your skills profile that you can share with those employers in the next
                step.
                {"\n\n"}
                As a last question, let's remind ourselves of what I told you further above: check again what I said
                three messages ago, how many percent of opportunities on <strong>{getJobPlatformUrl()}</strong> do you
                fulfill the required & most relevant skills of?
              </>
            }
          >
            <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
              <SkillsRankingSlider
                value={value}
                onChange={(_, newVal) => {
                  setStartedEditing(true);
                  setValue(newVal as number);
                }}
                disabled={submitted || !isOnline || currentPhase !== SkillsRankingPhase.RETYPED_RANK}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_SLIDER}
                aria-label="Retyped rank percentile slider"
              />

              <Box mt={theme.spacing(2)} textAlign="right">
                <PrimaryButton
                  onClick={handleSubmit}
                  disabled={
                    submitted || !startedEditing || !isOnline || currentPhase !== SkillsRankingPhase.RETYPED_RANK
                  }
                  data-testid={DATA_TEST_ID.SKILLS_RANKING_RETYPED_RANK_SUBMIT_BUTTON}
                >
                  Submit
                </PrimaryButton>
              </Box>
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

      <AnimatePresence mode="wait">
        {showTyping && (
          <motion.div
            key="typing"
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

export default SkillsRankingRetypedRank;
