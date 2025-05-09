import React from "react";
import { Box, Typography, useTheme, Divider } from "@mui/material";
import { ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { IChatMessage } from "src/chat/Chat.types";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";

const uniqueId = "cb5e9e43-c288-4597-b6f4-a268623c9e61";

export const DATA_TEST_ID = {
  SKILLS_RANKING_VOTE_CONTAINER: `skills-ranking-vote-container-${uniqueId}`,
  SKILLS_RANKING_VOTE_TEXT: `skills-ranking-vote-text-${uniqueId}`,
  SKILLS_RANKING_VOTE_RADIO: `skills-ranking-vote-radio-${uniqueId}`,
  SKILLS_RANKING_VOTE_DIVIDER: `skills-ranking-vote-divider-${uniqueId}`,
};

export interface SkillsRankingVoteProps {
  group: ExperimentGroup;
  onRankSelect: (rank: string) => void;
  chatMessage: IChatMessage;
  disabled?: boolean;
}

export const RANK_OPTIONS = Array.from({ length: 11 }, (_, i) => ({
  value: `${i * 10}%`,
  percent: i * 10,
}));

export const QUESTION_TEXTS = {
  [ExperimentGroup.GROUP_A]: "Before I tell you, how do your current skillset ranks compared to other job seekers?",
  [ExperimentGroup.GROUP_B]:
    "Before I tell you, how do your current skillset ranks compared to skills demanded in available jobs?",
};

const SkillsRankingVote: React.FC<SkillsRankingVoteProps> = ({
  group,
  onRankSelect,
  disabled = false,
  chatMessage,
}) => {
  const theme = useTheme();
  const questionText = QUESTION_TEXTS[group];
  const [selected, setSelected] = React.useState<number | null>(null);

  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_CONTAINER}>
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}>
          <Typography variant="body1" data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_TEXT}>
            {questionText}
          </Typography>
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
            width="100%"
          >
            <Box display="flex" alignItems="center" width="100%">
              {RANK_OPTIONS.map((option, i) => (
                <React.Fragment key={option.value}>
                  <PrimaryIconButton
                    onClick={() => {
                      setSelected(i);
                      onRankSelect(RANK_OPTIONS[i].value);
                    }}
                    disabled={disabled}
                    sx={{ p: 0, minWidth: 0, minHeight: 0, borderRadius: "50%" }}
                    data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_RADIO}
                  >
                    <span
                      style={{
                        display: "block",
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        border: `2px solid ${theme.palette.primary.dark}`,
                        background: i === selected ? theme.palette.primary.dark : "transparent",
                      }}
                    />
                  </PrimaryIconButton>
                  {i < RANK_OPTIONS.length - 1 && (
                    <Divider
                      sx={{
                        flex: 1,
                        background: theme.palette.primary.dark,
                        borderWidth: 1,
                      }}
                      data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_DIVIDER}
                    />
                  )}
                </React.Fragment>
              ))}
            </Box>
            <Box display="flex" justifyContent="space-between" width="100%">
              {RANK_OPTIONS.map(
                (option, index) =>
                  (index === 0 || index === RANK_OPTIONS.length - 1) && (
                    <Typography key={option.value} variant="caption">
                      {option.value}
                    </Typography>
                  )
              )}
            </Box>
          </Box>
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingVote;
