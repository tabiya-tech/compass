import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, FormControl, Typography, useTheme, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
  getLatestPhaseName,
} from "src/features/skillsRanking/types";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { AnimatePresence, motion } from "framer-motion";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { getDefaultTypingDurationMs } from "src/features/skillsRanking/constants";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";

const motivationScale = [
  { value: 1, label: "Very discouraged" },
  { value: 2, label: "Discouraged" },
  { value: 3, label: "Somewhat discouraged" },
  { value: 4, label: "Somewhat motivated" },
  { value: 5, label: "Motivated" },
  { value: 6, label: "Very motivated" },
];

export interface SkillsRankingApplicationMotivationProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingApplicationMotivation: React.FC<Readonly<SkillsRankingApplicationMotivationProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const typingTimeoutRef = useRef<number | null>(null);

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = currentPhase !== SkillsRankingPhase.APPLICATION_WILLINGNESS;
  const isGroupOne = skillsRankingState.metadata.experiment_group === SkillsRankingExperimentGroups.GROUP_1;

  const existingValue = skillsRankingState.user_responses.application_willingness?.value ?? null;
  const [selectedValue, setSelectedValue] = useState<number | null>(existingValue);
  const [submitted, setSubmitted] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const scrollRef = useAutoScrollOnChange(showTyping);

  useEffect(() => {
    setSelectedValue(skillsRankingState.user_responses.application_willingness?.value ?? null);
  }, [skillsRankingState.user_responses.application_willingness?.value]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const selectedOption = useMemo(
    () => motivationScale.find((option) => option.value === selectedValue),
    [selectedValue]
  );

  const handleSelect = (_event: React.MouseEvent<HTMLElement>, value: number | null) => {
    if (value === null) {
      return;
    }

    setSelectedValue(value);
  };

  const handleSubmit = () => {
    if (isReplay || submitted || selectedValue === null || !isOnline || currentPhase !== SkillsRankingPhase.APPLICATION_WILLINGNESS) {
      return;
    }

    setSubmitted(true);
    setShowTyping(true);

    const updatedState: SkillsRankingState = {
      ...skillsRankingState,
      user_responses: {
        ...skillsRankingState.user_responses,
        application_willingness: selectedOption ?? undefined,
      },
    };

    typingTimeoutRef.current = window.setTimeout(async () => {
      setShowTyping(false);
      await onFinish(updatedState);
    }, getDefaultTypingDurationMs());
  };

  if (isGroupOne) {
    return null;
  }

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble
          sender={ConversationMessageSender.COMPASS}
          message={
            <Typography>
              We&apos;re now almost done. Just quickly, given this information, how motivated do you feel to apply to jobs
              at this moment?
            </Typography>
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <FormControl fullWidth component="fieldset">
              <ToggleButtonGroup
                value={selectedValue}
                exclusive
                fullWidth
                aria-label="Motivation to apply"
                onChange={handleSelect}
                sx={{
                  borderRadius: theme.shape.borderRadius * 3,
                  overflow: "hidden",
                  border: `1px solid ${theme.palette.grey[300]}`,
                  "& .MuiToggleButton-root": {
                    flex: 1,
                    border: "none",
                    borderRadius: 0,
                    color: theme.palette.text.primary,
                    padding: theme.spacing(1, 0),
                    fontWeight: 500,
                    fontSize: theme.typography.pxToRem(14),
                    textTransform: "none",
                    "&.Mui-selected": {
                      backgroundColor: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                      "&:hover": {
                        backgroundColor: theme.palette.primary.dark,
                      },
                    },
                    "&:not(.Mui-selected)": {
                      backgroundColor: theme.palette.common.white,
                    },
                  },
                  "& .MuiToggleButtonGroup-grouped:not(:last-of-type)": {
                    borderRight: `1px solid ${theme.palette.grey[300]}`,
                  },
                }}
              >
                {motivationScale.map((option) => (
                  <ToggleButton
                    key={option.value}
                    value={option.value}
                    disabled={isReplay || submitted || !isOnline || currentPhase !== SkillsRankingPhase.APPLICATION_WILLINGNESS}
                    aria-label={option.label}
                  >
                    {option.value}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <Box display="flex" justifyContent="space-between" mt={1}>
                <Typography variant="body2" color="text.secondary">
                  {motivationScale[0].label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {motivationScale[motivationScale.length - 1].label}
                </Typography>
              </Box>
            </FormControl>

            <Box mt={theme.spacing(2)} textAlign="right">
              <PrimaryButton
                onClick={handleSubmit}
                disabled={isReplay || submitted || selectedValue === null || !isOnline || currentPhase !== SkillsRankingPhase.APPLICATION_WILLINGNESS}
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

export default SkillsRankingApplicationMotivation;

