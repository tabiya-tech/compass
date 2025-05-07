import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { ExperimentGroup, RankValue } from "src/chat/chatMessage/skillsRanking/types";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { ISkillsRankingVoteMessage } from "src/chat/Chat.types";
import BucketLevel from "src/theme/BucketLevel/BucketLevel";

const uniqueId = "cb5e9e43-c288-4597-b6f4-a268623c9e61";

export const DATA_TEST_ID = {
  SKILLS_RANKING_VOTE_CONTAINER: `skills-ranking-vote-container-${uniqueId}`,
  SKILLS_RANKING_VOTE_TEXT: `skills-ranking-vote-text-${uniqueId}`,
  SKILLS_RANKING_VOTE_ICON: `skills-ranking-vote-icon-${uniqueId}`,
};

export interface SkillsRankingVoteProps {
  chatMessage: ISkillsRankingVoteMessage;
  group: ExperimentGroup;
  onRankSelect: (rank: RankValue) => void;
  disabled?: boolean;
  error: string | null;
}

export const RANK_OPTIONS: Array<{ value: RankValue; opacity: number }> = [
  { value: "10%", opacity: 0.1 },
  { value: "20%", opacity: 0.2 },
  { value: "30%", opacity: 0.3 },
  { value: "40%", opacity: 0.4 },
  { value: "50%", opacity: 0.5 },
  { value: "60%", opacity: 0.6 },
  { value: "70%", opacity: 0.7 },
  { value: "80%", opacity: 0.8 },
  { value: "90%", opacity: 0.9 },
  { value: "100%", opacity: 1 },
];

export const QUESTION_TEXTS = {
  [ExperimentGroup.GROUP_A]: "Before I tell you, how do your current skillset ranks compared to other job seekers?",
  [ExperimentGroup.GROUP_B]:
    "Before I tell you, how do your current skillset ranks compared to skills demanded in available jobs?",
};

const SkillsRankingVote: React.FC<SkillsRankingVoteProps> = ({
  chatMessage,
  group,
  onRankSelect,
  disabled = false,
  error,
}) => {
  const theme = useTheme();
  const questionText = QUESTION_TEXTS[group];
  const [selectedRank, setSelectedRank] = React.useState<RankValue | undefined>(undefined);

  const handleRankSelect = (rank: RankValue) => {
    setSelectedRank(rank);
    chatMessage.onRankSelect(rank);
  };

  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_CONTAINER}>
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender}>
        <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          <Typography variant="body1" data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_TEXT}>
            {questionText}
          </Typography>
          {error && (
            <Typography color="error" variant="caption">
              {error}
            </Typography>
          )}
          <Box display="grid" gridTemplateColumns="repeat(5, 1fr)" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            {RANK_OPTIONS.map((option) => (
              <Box key={option.value} display="flex" flexDirection="column" alignItems="center">
                <Typography variant="caption">{option.value}</Typography>
                <BucketLevel
                  fillLevel={parseInt(option.value)}
                  onClick={() => handleRankSelect(option.value)}
                  disabled={disabled}
                  selected={selectedRank === option.value}
                  data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_ICON}
                />
              </Box>
            ))}
          </Box>
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingVote;
