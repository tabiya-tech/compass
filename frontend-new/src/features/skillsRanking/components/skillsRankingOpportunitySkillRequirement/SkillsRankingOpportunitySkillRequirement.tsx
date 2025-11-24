import React, { useContext, useEffect, useMemo, useState } from "react";
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
import { getDefaultTypingDurationMs, getJobPlatformUrl } from "src/features/skillsRanking/constants";

const uniqueId = "1db28aba-6396-4629-8f0a-cc22034d155b";

export const DATA_TEST_ID = {
  SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_CONTAINER: `skills-ranking-opportunity-skill-requirement-container-${uniqueId}`,
  SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SLIDER: `skills-ranking-opportunity-skill-requirement-slider-${uniqueId}`,
  SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SUBMIT_BUTTON: `skills-ranking-opportunity-skill-requirement-submit-button-${uniqueId}`,
};

export const SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_MESSAGE_ID = `skills-ranking-opportunity-skill-requirement-message-${uniqueId}`;

export interface Props {
  isReadOnly: boolean;
  mostDemandedLabel: string;
  sentAt: string;
  onSubmit: (value: number) => void;
  defaultValue?: number;
}

const SkillsRankingOpportunitySkillRequirement: React.FC<Readonly<Props>> = ({
  isReadOnly,
  mostDemandedLabel,
  defaultValue,
  sentAt,
  onSubmit,
}) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);

  const [value, setValue] = useState(defaultValue ?? 0);
  const [startedEditing, setStartedEditing] = useState(defaultValue !== undefined);
  const [submitted, setSubmitted] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);

  const scrollStep = useMemo(() => (isTypingVisible ? 1 : 0), [isTypingVisible]);
  const scrollRef = useAutoScrollOnChange(scrollStep);

  useEffect(() => {
    if (defaultValue !== undefined) {
      setValue(defaultValue);
      setStartedEditing(true);
    }
  }, [defaultValue]);

  const handleChange = (_: Event, newValue: number | number[]) => {
    if (isReadOnly) return;
    setStartedEditing(true);
    setValue(newValue as number);
  };

  const handleSubmit = () => {
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
      data-testid={DATA_TEST_ID.SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      ref={scrollRef}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble
          sender={ConversationMessageSender.COMPASS}
          message={
            <Typography>
              A very last, slightly different question:&nbsp;
              <strong>Thinking of 100 random opportunities</strong>
              &nbsp;from ALL opportunities&nbsp;
              <strong>{getJobPlatformUrl()}</strong>
              &nbsp;in the last 6 months in your province...&nbsp;
              <strong>how many of them do you believe ask for {mostDemandedLabel}?</strong>
            </Typography>
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <SkillsRankingSlider
              value={value}
              onChange={handleChange}
              disabled={isReadOnly || submitted || !isOnline}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SLIDER}
              aria-label="Opportunity skill requirement slider"
            />
            <Box mt={theme.spacing(2)} textAlign="right">
              <PrimaryButton
                onClick={handleSubmit}
                disabled={isReadOnly || !startedEditing || submitted || !isOnline}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SUBMIT_BUTTON}
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

export default SkillsRankingOpportunitySkillRequirement;
