import React, { useContext, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import SkillsRankingSlider from "src/features/skillsRanking/components/skillsRankingSlider/SkillsRankingSlider";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { getDefaultTypingDurationMs } from "src/features/skillsRanking/constants";

const uniqueId = "7c582beb-6070-43b0-92fb-7fd0a4cb533e";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PERCEIVED_RANK_CONTAINER: `skills-ranking-perceived-rank-container-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_SLIDER: `skills-ranking-perceived-rank-slider-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON: `skills-ranking-perceived-rank-submit-button-${uniqueId}`,
};

export const SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID = `skills-ranking-perceived-rank-message-${uniqueId}`;

export interface SkillsRankingPerceivedRankProps {
  isReadOnly: boolean;
  mostDemandedLabel: string;
  sentAt: string;
  onSubmit: (value: number) => void;
  defaultValue?: number;
}

const SkillsRankingPerceivedRank: React.FC<Readonly<SkillsRankingPerceivedRankProps>> = ({
  isReadOnly,
  mostDemandedLabel,
  defaultValue,
  sentAt,
  onSubmit,
}) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);

  const existingValue = defaultValue ?? 0;
  const [value, setValue] = useState(existingValue);
  const [startedEditing, setStartedEditing] = useState(existingValue > 0);
  const [submitted, setSubmitted] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);

  const scrollRef = useAutoScrollOnChange(isReadOnly || isTypingVisible);

  const handleChange = (_: Event, newValue: number | number[]) => {
    if (isReadOnly) return;
    setStartedEditing(true);
    setValue(newValue as number);
  };

  const handleSubmit = async () => {
    if (isReadOnly || submitted || !startedEditing || !isOnline) {
      return;
    }

    setSubmitted(true);
    setIsTypingVisible(true);

    setTimeout(() => {
      setIsTypingVisible(false);
      onSubmit(value);
    }, getDefaultTypingDurationMs());
  };

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
            <Typography>
              Remember, the sample (1/3 of opportunities) showed that {mostDemandedLabel} was 'above average' in demand.
              Given this, <strong>what is the chance (0–100%) that {mostDemandedLabel} is actually 'above average' in demand for ALL</strong> opportunities on SAYouth.mobi from the last 6 months in your province? (Try to give your best guess;
              the more accurate you are, the more airtime you will receive.)
            </Typography>
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <SkillsRankingSlider
              value={value}
              onChange={handleChange}
              disabled={isReadOnly || submitted || !isOnline}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SLIDER}
              aria-label="Perceived rank for skill percentile slider"
            />
            <Box mt={theme.spacing(2)} textAlign="right">
              <PrimaryButton
                onClick={handleSubmit}
                disabled={isReadOnly || !startedEditing || submitted || !isOnline}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON}
              >
                Submit
              </PrimaryButton>
            </Box>
          </Box>
        </ChatBubble>

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp sentAt={sentAt} />
        </ChatMessageFooterLayout>
      </Box>

      <AnimatePresence mode="wait">
        {isTypingVisible && (
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
