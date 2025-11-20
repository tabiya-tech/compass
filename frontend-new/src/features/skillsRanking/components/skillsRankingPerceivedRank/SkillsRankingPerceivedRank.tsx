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
      data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble
          sender={ConversationMessageSender.COMPASS}
          message={
            <>
              Remember, the sample (1/3 of opportunities) showed that {mostDemandedLabel} was 'above average' in demand.
              Given this,&nbsp;
              <strong>
                what is the chance (0–100%) that {mostDemandedLabel} is actually 'above average' in demand for ALL
              </strong>
              &nbsp;opportunities on SAYouth.mobi from the last 6 months in your province? (Try to give your best guess;
              the more accurate you are, the more airtime you will receive.)
            </>
          }
        >
          <Box padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <SkillsRankingSlider
              value={value}
              onChange={handleChange}
              disabled={isReadOnly || !isOnline}
              data-testid={DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SLIDER}
              aria-label="Perceived rank for skill percentile slider"
            />
            <Box mt={theme.spacing(2)} textAlign="right">
              <PrimaryButton
                onClick={handleSubmit}
                disabled={isReadOnly || !startedEditing || !isOnline}
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
    </MessageContainer>
  );
};

export default SkillsRankingPerceivedRank;
