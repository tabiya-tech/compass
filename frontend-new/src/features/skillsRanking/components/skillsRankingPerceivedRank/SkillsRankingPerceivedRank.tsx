import React, { useState, useContext, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Box, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { SkillsRankingState, SkillsRankingPhase, getLatestPhaseName } from "src/features/skillsRanking/types";
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
import { getJobPlatformUrl, getDefaultTypingDurationMs } from "src/features/skillsRanking/constants";
import SkillsRankingSlider from "src/features/skillsRanking/components/skillsRankingSlider/SkillsRankingSlider";
import { shouldSkipMarketDisclosure } from "src/features/skillsRanking/utils/createMessages";

const uniqueId = "7c582beb-6070-43b0-92fb-7fd0a4cb533e";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PERCEIVED_RANK_CONTAINER: `skills-ranking-perceived-rank-container-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_SLIDER: `skills-ranking-perceived-rank-slider-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON: `skills-ranking-perceived-rank-submit-button-${uniqueId}`,
};

export const SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID = `skills-ranking-perceived-rank-message-${uniqueId}`;

export interface SkillsRankingPerceivedRankProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingPerceivedRank: React.FC<Readonly<SkillsRankingPerceivedRankProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();

  const [value, setValue] = useState(0);
  const [startedEditing, setStartedEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showTyping, setShowTyping] = useState(false);

  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const scrollRef = useAutoScrollOnChange(submitted ? 1 : 0);

  // Check if user has seen market disclosure
  const shouldShowMarketDisclosure = !shouldSkipMarketDisclosure(skillsRankingState.experiment_group);

  const handleChange = (_: Event, newValue: number | number[]) => {
    setStartedEditing(true);
    setValue(newValue as number);
  };

  const { t } = useTranslation();
  const handleSubmit = async () => {
    if (submitted || !startedEditing || !isOnline || currentPhase !== SkillsRankingPhase.PERCEIVED_RANK) {
      return;
    }

    setSubmitted(true);
    setShowTyping(true);

    try {
      const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (!activeSessionId) {
        console.error(new SkillsRankingError("Active session ID is not available."));
        return;
      }

      // Determine the next phase based on experiment group
      const nextPhase = shouldShowMarketDisclosure
        ? SkillsRankingPhase.RETYPED_RANK 
        : SkillsRankingPhase.COMPLETED;

      const updatedState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        nextPhase,
        value
      );

      // Wait the full typing duration before calling onFinish
      setTimeout(() => {
        setShowTyping(false);
        onFinish(updatedState);
      }, getDefaultTypingDurationMs());
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
      enqueueSnackbar(t("common.errors.updateState"), {
        variant: "error",
      });
      setShowTyping(false);
      setSubmitted(false); // allow retry
    }
  };

  useEffect(() => {
    if (currentPhase !== SkillsRankingPhase.PERCEIVED_RANK) {
      setValue(skillsRankingState.perceived_rank_percentile ?? 0);
    }
  }, [skillsRankingState, currentPhase]);

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      ref={scrollRef}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble
          sender={ConversationMessageSender.COMPASS}
          message={
            shouldShowMarketDisclosure ? (
              <Trans
                i18nKey="features.skillsRanking.components.skillsRankingPerceivedRank.questionWithDisclosure"
                components={{ 0: <strong />, 1: <strong />, 2: <strong />, 3: <strong />, 4: <strong /> }}
                values={{ jobPlatformUrl: getJobPlatformUrl() }}
              />
            ) : (
              <Trans
                i18nKey="features.skillsRanking.components.skillsRankingPerceivedRank.questionWithoutDisclosure"
                components={{ 0: <strong />, 1: <strong /> }}
                values={{ jobPlatformUrl: getJobPlatformUrl() }}
              />
            )
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <SkillsRankingSlider
              value={value}
              onChange={handleChange}
              disabled={submitted || !isOnline || currentPhase !== SkillsRankingPhase.PERCEIVED_RANK}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SLIDER}
              aria-label={t("features.skillsRanking.components.skillsRankingPerceivedRank.sliderAria")}
            />

            <Box mt={theme.spacing(2)} textAlign="right">
              <PrimaryButton
                onClick={handleSubmit}
                disabled={
                  submitted || !startedEditing || !isOnline || currentPhase !== SkillsRankingPhase.PERCEIVED_RANK
                }
                data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON}
              >
                {t("common.buttons.submit")}
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

export default SkillsRankingPerceivedRank;
