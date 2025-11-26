import React, { useContext, useEffect, useRef, useState } from "react";
import { Box, Slider, Typography, useTheme } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { SkillsRankingPhase, SkillsRankingState, getLatestPhaseName } from "src/features/skillsRanking/types";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { AnimatePresence, motion } from "framer-motion";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { getDefaultTypingDurationMs } from "src/features/skillsRanking/constants";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import HelpTip from "src/theme/HelpTip/HelpTip";

const uniqueId = "9d769ba5-2b41-45b5-8bea-2240bf34a7fb";

export const DATA_TEST_ID = {
  CONTAINER: `skills-ranking-application-hours-container-${uniqueId}`,
  SLIDER: `skills-ranking-application-hours-slider-${uniqueId}`,
  SUBMIT_BUTTON: `skills-ranking-application-hours-submit-${uniqueId}`,
};

const marks = [
  { value: 0, label: "0h" },
  { value: 24, label: "24h" },
];

export interface SkillsRankingApplication24hProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingApplication24h: React.FC<Readonly<SkillsRankingApplication24hProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const typingTimeoutRef = useRef<number | null>(null);

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = currentPhase !== SkillsRankingPhase.APPLICATION_24H;

  const existingValue = skillsRankingState.user_responses.application_24h ?? 0;
  const [hours, setHours] = useState<number>(existingValue);
  const [submitted, setSubmitted] = useState(false);
  const [startedEditing, setStartedEditing] = useState(existingValue > 0);
  const [showTyping, setShowTyping] = useState(false);
  const scrollRef = useAutoScrollOnChange(showTyping);

  useEffect(() => {
    setHours(skillsRankingState.user_responses.application_24h ?? 0);
  }, [skillsRankingState.user_responses.application_24h]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = (_: Event, value: number | number[]) => {
    setStartedEditing(true);
    setHours(value as number);
  };

  const handleSubmit = () => {
    if (isReplay || submitted || !startedEditing || !isOnline || currentPhase !== SkillsRankingPhase.APPLICATION_24H) {
      return;
    }
    setSubmitted(true);
    setShowTyping(true);

    const updatedState: SkillsRankingState = {
      ...skillsRankingState,
      user_responses: {
        ...skillsRankingState.user_responses,
        application_24h: hours,
      },
    };

    typingTimeoutRef.current = window.setTimeout(async () => {
      setShowTyping(false);
      await onFinish(updatedState);
    }, getDefaultTypingDurationMs());
  };

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      ref={scrollRef}
      data-testid={DATA_TEST_ID.CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble
          sender={ConversationMessageSender.COMPASS}
          message={
            <Typography component="div">
              How many hours do you plan to spend searching and applying in the next 24 hours? <strong>Slide to choose from 0 to 24 hours.</strong>{" "}
              <HelpTip icon={<InfoIcon />}>
                0h means no time spent. 24h means the full day dedicated to applications.
              </HelpTip>
            </Typography>
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <Slider
              value={hours}
              onChange={handleChange}
              min={0}
              max={24}
              step={1}
              marks={marks}
              valueLabelDisplay="on"
              valueLabelFormat={(value) => `${value}h`}
              disabled={isReplay || submitted || !isOnline || currentPhase !== SkillsRankingPhase.APPLICATION_24H}
              data-testid={DATA_TEST_ID.SLIDER}
              aria-label="Hours willing to apply in next 24h"
              sx={{
                mb: 4,
                "& .MuiSlider-valueLabel": {
                  top: "auto",
                  bottom: "-70px",
                  "&::before": {
                    top: "-8px",
                    bottom: "auto",
                    borderTopColor: "transparent",
                    borderBottomColor: "currentColor",
                  },
                },
              }}
            />

            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: theme.spacing(1, 2),
                backgroundColor: theme.palette.success.light,
                color: theme.palette.success.contrastText,
                borderRadius: 1,
                border: `1px solid ${theme.palette.success.main}`,
                mb: 2,
                gap: theme.spacing(1),
              }}
            >
              <Typography variant="body2" sx={{ color: "inherit" }}>
                Planned time
              </Typography>
              <Typography variant="body1" fontWeight={600} sx={{ color: "inherit" }}>
                {hours}h
              </Typography>
            </Box>

            <Box mt={theme.spacing(2)} textAlign="right">
              <PrimaryButton
                onClick={handleSubmit}
                disabled={isReplay || submitted || !startedEditing || !isOnline || currentPhase !== SkillsRankingPhase.APPLICATION_24H}
                data-testid={DATA_TEST_ID.SUBMIT_BUTTON}
              >
                Submit
              </PrimaryButton>
            </Box>
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

export default SkillsRankingApplication24h;

