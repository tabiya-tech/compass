import React, { useContext, useState } from "react";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { Box, Typography, useTheme } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import { AnimatePresence, motion } from "framer-motion";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import {
  getLatestPhaseName,
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import SkillsRankingSlider from "src/features/skillsRanking/components/skillsRankingSlider/SkillsRankingSlider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { getJobPlatformUrl, getDefaultTypingDurationMs, SKILL_GROUP_DESCRIPTIONS } from "src/features/skillsRanking/constants";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import HelpTip from "src/theme/HelpTip/HelpTip";

const uniqueId = "8d8d3e2f-7ba5-4f34-aaf2-b0fc39bc6c59";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PRIOR_BELIEF_CONTAINER: `skills-ranking-prior-belief-container-${uniqueId}`,
  SKILLS_RANKING_PRIOR_BELIEF_SLIDER: `skills-ranking-prior-belief-slider-${uniqueId}`,
  SKILLS_RANKING_PRIOR_BELIEF_SUBMIT_BUTTON: `skills-ranking-prior-belief-submit-button-${uniqueId}`,
};

export interface SkillsRankingPriorBeliefProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

export const SKILLS_RANKING_PRIOR_BELIEF_MESSAGE_ID = `skills-ranking-prior-belief-message`;

const renderSkillLabelWithTooltip = (label?: string) => {
  if (!label) {
    return null;
  }

  // important: trim and lowercase to match keys in SKILL_GROUP_DESCRIPTIONS
  // if the label doesnt exist in the dictionary (since we're not using uuids), we just return the label without tooltip
  const description = SKILL_GROUP_DESCRIPTIONS[label.trim().toLowerCase()];

  if (!description) {
    return label;
  }

  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      {label}
      <HelpTip icon={<InfoIcon fontSize="small" />}>{description}</HelpTip>
    </Box>
  );
};

const renderSkillListWithTooltips = (labels: string[]) => {
  if (!labels.length) {
    return "—";
  }

  return labels.map((label, index) => (
    <React.Fragment key={`${label}-${index}`}>
      {renderSkillLabelWithTooltip(label)}
      {index < labels.length - 1 && ", "}
    </React.Fragment>
  ));
};

const SkillsRankingPriorBelief: React.FC<Readonly<SkillsRankingPriorBeliefProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const existingValue = skillsRankingState.user_responses.prior_belief_percentile ?? 0;
  const [value, setValue] = useState(existingValue);
  const [startedEditing, setStartedEditing] = useState(existingValue > 0);
  const [submitted, setSubmitted] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const scrollRef = useAutoScrollOnChange(showTyping);

  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = currentPhase !== SkillsRankingPhase.PRIOR_BELIEF;

  const aboveAverageSkillLabels = skillsRankingState.score.above_average_labels;
  const belowAverageSkillLabels = skillsRankingState.score.below_average_labels;
  const mostDemandedSkillLabel = skillsRankingState.score.most_demanded_label;

  const handleChange = (_: Event, newValue: number | number[]) => {
    setStartedEditing(true);
    setValue(newValue as number);
  };

  const handleSubmit = async () => {
    if (isReplay || submitted || !startedEditing || !isOnline || currentPhase !== SkillsRankingPhase.PRIOR_BELIEF) {
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

      const updatedState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL,
        { prior_belief: value }
      );

      // Wait the full typing duration before calling onFinish
      setTimeout(() => {
        setShowTyping(false);
        onFinish(updatedState);
      }, getDefaultTypingDurationMs());
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
      enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
        variant: "error",
      });
      setShowTyping(false);
      setSubmitted(false); // allow retry
    }
  };

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_CONTAINER}
      ref={scrollRef}
    >
      <Box>
        <ChatBubble
          sender={ConversationMessageSender.COMPASS}
          message={
            <Typography>
              {skillsRankingState.metadata.experiment_group !== SkillsRankingExperimentGroups.GROUP_1 && <span>Just before I tell you,</span>} I am curious about your thoughts. <strong>In our conversation, we found that you have
              skills in the following areas:</strong>{" "}
              {renderSkillListWithTooltips(aboveAverageSkillLabels)}, and {renderSkillListWithTooltips(belowAverageSkillLabels)}. <br />
              <br />
              For the next few questions, please give your best guess. <strong>The more accurate your guesses are, the more airtime you will receive.</strong>
              <br />
              <br />
              <strong>How likely</strong> do you think your <strong>{renderSkillLabelWithTooltip(mostDemandedSkillLabel)} is 'above average'</strong>{" "}
              in demand on {getJobPlatformUrl()} (in your province, in the last 6 months)? Please give your best guess
              from 0% to 100%.
            </Typography>
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <SkillsRankingSlider
              value={value}
              onChange={handleChange}
              disabled={isReplay || submitted || !isOnline || currentPhase !== SkillsRankingPhase.PRIOR_BELIEF}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SLIDER}
              aria-label="Prior beliefs elicitation percentile slider"
            />

            <Box mt={theme.spacing(2)} textAlign="right">
              <PrimaryButton
                onClick={handleSubmit}
                disabled={isReplay || submitted || !startedEditing || !isOnline || currentPhase !== SkillsRankingPhase.PRIOR_BELIEF}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SUBMIT_BUTTON}
              >
                Submit
              </PrimaryButton>
            </Box>
          </Box>
        </ChatBubble>

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp sentAt={skillsRankingState.phase.at(-1)?.time || skillsRankingState.metadata.started_at} />
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

export default SkillsRankingPriorBelief;
