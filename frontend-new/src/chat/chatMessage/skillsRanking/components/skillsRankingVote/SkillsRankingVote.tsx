import React, { useContext } from "react";
import { Box, Typography, useTheme, styled } from "@mui/material";
import { ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { IChatMessage } from "src/chat/Chat.types";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import SkillsRankingVoteItem from "src/chat/chatMessage/skillsRanking/components/skillsRankingVote/components/skillsRankingVoteItem/SkillsRankingVoteItem";

const uniqueId = "cb5e9e43-c288-4597-b6f4-a268623c9e61";

export const DATA_TEST_ID = {
  SKILLS_RANKING_VOTE_CONTAINER: `skills-ranking-vote-container-${uniqueId}`,
  SKILLS_RANKING_VOTE_TEXT: `skills-ranking-vote-text-${uniqueId}`,
};

export interface SkillsRankingVoteProps {
  group: ExperimentGroup;
  onRankSelect: (rank: string) => void;
  chatMessage: IChatMessage;
  disabled?: boolean;
}

export const OPTIONS = [
  { value: "0%", percent: 0 },
  { value: "10%", percent: 10 },
  { value: "20%", percent: 20 },
  { value: "30%", percent: 30 },
  { value: "40%", percent: 40 },
  { value: "50%", percent: 50 },
  { value: "60%", percent: 60 },
  { value: "70%", percent: 70 },
  { value: "80%", percent: 80 },
  { value: "90%", percent: 90 },
  { value: "100%", percent: 100 },
];

export const QUESTION_TEXTS = {
  [ExperimentGroup.GROUP_A]: "Before I tell you, how do your current skillset ranks compared to other job seekers?",
  [ExperimentGroup.GROUP_B]:
    "Before I tell you, how do your current skillset ranks compared to skills demanded in available jobs?",
};

const TopLabel = styled(Typography)<{ disabled: boolean }>(({ theme, disabled }) => ({
  color: disabled ? theme.palette.grey[500] : theme.palette.text.primary,
}));

const SkillsRankingVote: React.FC<SkillsRankingVoteProps> = ({
  group,
  onRankSelect,
  disabled = false,
  chatMessage,
}) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const questionText = QUESTION_TEXTS[group];
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_CONTAINER}>
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender}>
        <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
          <Typography variant="body1" data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_TEXT}>
            {questionText}
          </Typography>
          <Box display="flex" flexDirection="column" alignItems="center" width="100%">
            {/* Top label */}
            <Box display="flex" justifyContent="space-between" width="100%">
              <TopLabel variant="caption" disabled={disabled}>
                0%
              </TopLabel>
              <TopLabel variant="caption" disabled={disabled}>
                100%
              </TopLabel>
            </Box>

            {/* Options */}
            <Box display="flex" alignItems="center" width="100%" sx={{ opacity: disabled ? 0.5 : 1 }}>
              {OPTIONS.map((option, index) => (
                <SkillsRankingVoteItem
                  key={option.value}
                  option={option}
                  index={index}
                  selectedIndex={selectedIndex}
                  hoveredIndex={hoveredIndex}
                  disabled={!isOnline || disabled}
                  onSelect={(index: number) => {
                    setSelectedIndex(index);
                    onRankSelect(option.value);
                  }}
                  onHover={setHoveredIndex}
                  isLast={index === OPTIONS.length - 1}
                />
              ))}
            </Box>

            {/* Bottom Label */}
            <Box sx={{ height: "1.5rem" }}>
              {selectedIndex !== null && (
                <Typography variant="caption" align="center">
                  Selected value: <strong>{OPTIONS[selectedIndex].value}</strong>
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingVote;
