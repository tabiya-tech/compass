import { getLatestPhaseName, SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { Box, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { AnimatePresence, motion } from "framer-motion";
import TypingChatMessage from "../../../../chat/chatMessage/typingChatMessage/TypingChatMessage";
import React, { useContext, useState } from "react";
import SkillsRankingMultiThumbSlider from "../skillsRankingSlider/SkillsRankingMultiThumbSlider";
import { IsOnlineContext } from "../../../../app/isOnlineProvider/IsOnlineProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { useAutoScrollOnChange } from "../../hooks/useAutoScrollOnChange";

const uniqueId = "ccc746b5-19a8-406c-8438-820794d84cb1";

export const SKILLS_RANKING_DISCLOSURE_MESSAGE_ID = `skills-ranking-disclosure-message-${uniqueId}`;

export interface SkillsRankingDisclosureProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingDisclosure: React.FC<SkillsRankingDisclosureProps> = ({ onFinish, skillsRankingState }) => {
  const theme = useTheme();
  const [value, setValue] = useState(0);
  const [startedEditing, setStartedEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showTyping, setShowTyping] = useState(false);

  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const handleChange = (_: Event, newValue: number | number[]) => {
    setStartedEditing(true);
    setValue(newValue as number);
  };

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const scrollRef = useAutoScrollOnChange(submitted ? 1 : 0);

  const disclosureValues = [
    { value: 20, label: "Your Guess", color: theme.palette.secondary.main },
    { value: 60, label: "Team Average", color: theme.palette.warning.main },
    { value: 80, label: "Actual Demand", color: theme.palette.success.main },
  ];

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
           Important: To get this information, we looked at a random sample of the opportunities (about 1 out of every 3) from the last 6 months in your province. 
           Because this is a sample and not all the opportunities, <strong> it gives a good signal, but it is not a 100% complete picture.</strong>
         </>
         }
         >
         <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
           <SkillsRankingMultiThumbSlider values={disclosureValues} onChange={handleChange} disabled={submitted || !isOnline}
                                          min={0}
                                          max={100}
                                          step={1}
                                          aria-label="Skills ranking disclosure comparison slider"
           />

         </Box>

       </ChatBubble>
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

export default SkillsRankingDisclosure;
