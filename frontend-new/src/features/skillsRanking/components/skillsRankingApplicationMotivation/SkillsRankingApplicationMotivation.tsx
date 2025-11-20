import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, FormControl, FormControlLabel, Radio, RadioGroup, Typography, useTheme } from "@mui/material";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { SkillsRankingExperimentGroups, SkillsRankingState } from "src/features/skillsRanking/types";
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
  const scrollRef = useAutoScrollOnChange(0);
  const typingTimeoutRef = useRef<number | null>(null);

  const [selectedValue, setSelectedValue] = useState<number | null>(
    skillsRankingState.application_willingness?.value ?? null
  );
  const [submitted, setSubmitted] = useState(false);
  const [showTyping, setShowTyping] = useState(false);

  const isGroupOne = skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_1;

  useEffect(() => {
    setSelectedValue(skillsRankingState.application_willingness?.value ?? null);
  }, [skillsRankingState.application_willingness?.value]);

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

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedValue(Number(event.target.value));
  };

  const handleSubmit = () => {
    if (submitted || selectedValue === null || !isOnline) {
      return;
    }

    setSubmitted(true);
    setShowTyping(true);

    const updatedState: SkillsRankingState = {
      ...skillsRankingState,
      application_willingness: selectedOption ?? undefined,
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
            <>
              We&apos;re now almost done. Just quickly, given this information, how motivated do you feel to apply to jobs
              at this moment?
            </>
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <FormControl fullWidth component="fieldset" disabled={submitted || !isOnline}>
              <RadioGroup
                row
                aria-label="Motivation to apply"
                name="application-motivation"
                value={selectedValue?.toString() ?? ""}
                onChange={handleSelect}
                sx={{
                  justifyContent: "space-between",
                  gap: theme.spacing(1),
                }}
              >
                {motivationScale.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value.toString()}
                    control={
                      <Radio
                        color="primary"
                        sx={{
                          padding: 0,
                          "& .MuiSvgIcon-root": {
                            fontSize: theme.spacing(9),
                            borderRadius: "50%",
                            backgroundColor:
                              selectedValue === option.value
                                ? theme.palette.primary.light
                                : theme.palette.common.white,
                          },
                        }}
                        inputProps={{ "aria-label": option.label }}
                      />
                    }
                    label=""
                    sx={{
                      margin: 0,
                      "& .MuiButtonBase-root": {
                        margin: 0,
                      },
                    }}
                  />
                ))}
              </RadioGroup>

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
              <PrimaryButton onClick={handleSubmit} disabled={submitted || selectedValue === null || !isOnline}>
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

