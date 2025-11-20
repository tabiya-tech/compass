import React, { useContext, useState } from "react";
import { Box, useTheme } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import SkillsRankingSlider from "src/features/skillsRanking/components/skillsRankingSlider/SkillsRankingSlider";

const uniqueId = "b0645605-1864-4170-a612-57c9fcda6dfc";

export const DATA_TEST_ID = {
  SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_CONTAINER: `skills-ranking-perceived-rank-for-skill-container-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_SLIDER: `skills-ranking-perceived-rank-for-skill-slider-${uniqueId}`,
  SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_SUBMIT_BUTTON: `skills-ranking-perceived-rank-for-skill-submit-button-${uniqueId}`,
};

export const SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_MESSAGE_ID = `skills-ranking-perceived-rank-for-skill-message-${uniqueId}`;

export interface Props {
  isReadOnly: boolean;
  leastDemandedLabel: string;
  sentAt: string;
  onSubmit: (value: number) => void;
  defaultValue?: number;
}

const SkillsRankingPerceivedRankForSkill: React.FC<Readonly<Props>> = ({
  isReadOnly,
  leastDemandedLabel,
  defaultValue,
  sentAt,
  onSubmit,
}) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);

  const [value, setValue] = useState(defaultValue || 0);
  const [startedEditing, setStartedEditing] = useState(false);

  const scrollRef = useAutoScrollOnChange(isReadOnly);

  const handleChange = (_: Event, newValue: number | number[]) => {
    setStartedEditing(true);
    setValue(newValue as number);
  };

  const handleSubmit = async () => {
    onSubmit(value);
  };

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      ref={scrollRef}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble
          sender={ConversationMessageSender.COMPASS}
          message={
            <>
              <strong>
                What about your {leastDemandedLabel}? What is the chance (0–100%) that it is 'above average' in demand
                for ALL
              </strong>
              &nbsp;
              <span>
                opportunities from the last 6 months in your province? (Again, try your best guess for more airtime.)
              </span>
            </>
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <SkillsRankingSlider
              value={value}
              onChange={handleChange}
              disabled={isReadOnly || !isOnline}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_SLIDER}
              aria-label="Perceived rank for skill percentile slider"
            />
            <Box mt={theme.spacing(2)} textAlign="right">
              <PrimaryButton
                onClick={handleSubmit}
                disabled={isReadOnly || !startedEditing || !isOnline}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_SUBMIT_BUTTON}
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
    </MessageContainer>
  );
};

export default SkillsRankingPerceivedRankForSkill;
