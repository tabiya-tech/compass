import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { SkillsRankingExperimentGroups } from "src/features/skillsRanking/types";
import { combineWords } from "src/utils/combineWords/combineWords";

const uniqueId = "67c4908b-b15f-4740-a017-84e509584c10";

export const DATA_TEST_ID = {
  SKILLS_RANKING_DISCLOSURE_CONTAINER: `skills-ranking-disclosure-container-${uniqueId}`,
};

export const SKILLS_RANKING_DISCLOSURE_CONTAINER_MESSAGE_ID = `skills-ranking-disclosure-message-${uniqueId}`;

interface Props {
  group: SkillsRankingExperimentGroups;
  mostDemandedLabel: string;
  mostDemandedLabelPercentage: number;
  aboveAverageLabels: string[];

  leastDemandedLabel: string;
  leastDemandedLabelPercentage: number;
  belowAverageLabels: string[];

  averagePercentForJobSeeker: number;

  sentAt: string;
}

// TODO: Separate the types
const Message: React.FC<Readonly<Props>> = ({
  group,
  aboveAverageLabels,
  mostDemandedLabel,
  leastDemandedLabel,
  belowAverageLabels,
}) => {
  const theme = useTheme();
  switch (group) {
    case SkillsRankingExperimentGroups.GROUP_1:
      return (
        <>
          I've gathered the relevant information, but ran into an error and need to run a few more checks on the
          opportunities listed on SAYouth.mobi to make sure we give you the most accurate and up-to-date details. We'll
          notify you as soon as everything is ready. Please bring this up during our phone survey in a few months if we
          still haven't reached out by then -- we’d be happy to revisit it with you then. Thanks for your patience!
        </>
      );
    case SkillsRankingExperimentGroups.GROUP_2:
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: theme.spacing(4) }}>
          <Typography>
            Important: To get this information, we looked at a random sample of the opportunities (about 1 out of every
            3) from the last 6 months in your province.
          </Typography>
          <Typography>
            Because this is a sample and not all the opportunities,
            <Typography component={"span"} sx={{ fontWeight: "bold" }}>
              it gives a good signal, but it is not a 100% complete picture.
            </Typography>
          </Typography>
          <Typography>In that data sample, here is what we found:</Typography>
          <Typography component={"span"} sx={{ backgroundColor: theme.palette.success.light }}>
            <Typography component={"span"} sx={{ fontWeight: "bold" }}>
              &#9650;&#9650; {mostDemandedLabel} is 'above average' in demand
            </Typography>
            , and the &nbsp;
            <Typography component={"span"} sx={{ fontWeight: "bold" }}>
              most demanded
            </Typography>
            &nbsp;of your skill areas.
          </Typography>
          <Typography component={"span"} sx={{ backgroundColor: theme.palette.success.light }}>
            <Typography component={"span"} sx={{ fontWeight: "bold" }}>
              &#9650; {combineWords(aboveAverageLabels)} is also 'above average'
            </Typography>
            in demand.
          </Typography>
        </Box>
      );
    case SkillsRankingExperimentGroups.GROUP_3:
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: theme.spacing(4) }}>
          Important: To get this information, we looked at a random sample of the opportunities (about 1 out of every 3)
          from the last 6 months in your province.
          <Typography>
            Because this is a sample and not all the opportunities,
            <Typography component={"span"} sx={{ fontWeight: "bold" }}>
              it gives a good signal, but it is not a 100% complete picture.
            </Typography>
          </Typography>
          <Typography>In that data sample, here is what we found:</Typography>
          <Typography>
            <Typography component={"span"} sx={{ backgroundColor: theme.palette.error.light }}>
              &#9660;&#9660; {leastDemandedLabel} is 'below average' in demand, and the least demanded of your skill
              areas.
            </Typography>
          </Typography>
          <Typography>
            <Typography component={"span"} sx={{ backgroundColor: theme.palette.error.light }}>
              &#9660; {combineWords(belowAverageLabels)} are also 'below average' in demand.
            </Typography>
          </Typography>
          <Typography>
            <Typography component={"span"} sx={{ backgroundColor: theme.palette.success.light }}>
              &#9650;&#9650; {mostDemandedLabel} is 'above average' in demand, and the most demanded of your skill
              areas.
            </Typography>
          </Typography>
          <Typography>
            <Typography component={"span"} sx={{ backgroundColor: theme.palette.success.light }}>
              <Typography component={"span"} sx={{ fontWeight: "bold" }}>
                &#9650; {aboveAverageLabels} is also 'above average'
              </Typography>{" "}
              in demand.
            </Typography>
          </Typography>
        </Box>
      );
    default:
      return null;
  }
};

const SkillsRankingDisclosure: React.FC<Readonly<Props>> = (props) => {
  const theme = useTheme();
  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTAINER}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble sender={ConversationMessageSender.COMPASS} message={<Message {...props} />}>
          {/* FIXME: Ad the arrow */}
        </ChatBubble>

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp sentAt={props.sentAt} />
        </ChatMessageFooterLayout>
      </Box>
    </MessageContainer>
  );
};

export default SkillsRankingDisclosure;
