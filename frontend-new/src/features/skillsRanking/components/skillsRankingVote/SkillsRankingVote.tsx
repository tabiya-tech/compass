import React, { useContext, useEffect, forwardRef } from "react";
import { Box, Typography, useTheme, styled } from "@mui/material";
import { 
  SkillsRankingCurrentState, 
  SkillsRankingState,
  CompareAgainstGroup
} from "src/features/skillsRanking/types";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import SkillsRankingVoteItem from "./components/SkillsRankingVoteItem";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";


const uniqueId = "cb5e9e43-c288-4597-b6f4-a268623c9e61";

export const SKILLS_RANKING_VOTE_MESSAGE_TYPE = `skills-ranking-vote-message-${uniqueId}`;

export const DATA_TEST_ID = {
  SKILLS_RANKING_VOTE_CONTAINER: `skills-ranking-vote-container-${uniqueId}`,
  SKILLS_RANKING_VOTE_TEXT: `skills-ranking-vote-text-${uniqueId}`,
  SKILLS_RANKING_VOTE_ICON: `skills-ranking-vote-icon-${uniqueId}`,
  SKILLS_RANKING_VOTE_ERROR: `skills-ranking-vote-error-${uniqueId}`,
};

export interface SkillsRankingVoteProps {
  message: string;
  onRankSelect: (rank: string) => void;
  disabled?: boolean;
  skillsRankingState: SkillsRankingState;
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
  [CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS]: "Before I tell you, how do your current skillset ranks compared to other job seekers?",
  [CompareAgainstGroup.AGAINST_JOB_MARKET]:
    "Before I tell you, how do your current skillset ranks compared to skills demanded in available jobs?",
};

const TopLabel = styled(Typography)<{ disabled: boolean }>(({ theme, disabled }) => ({
  color: disabled ? theme.palette.grey[500] : theme.palette.text.primary,
}));

export const SkillsRankingVote = forwardRef<HTMLDivElement, SkillsRankingVoteProps>(({
  skillsRankingState,
  message,
  onRankSelect,
  disabled = false,
}, ref) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const [questionText, setQuestionText] = React.useState<string>("");
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [isRankSelected, setIsRankSelected] = React.useState<boolean>(false);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);


  useEffect(() => {
    setQuestionText(QUESTION_TEXTS[skillsRankingState.experiment_groups.compare_against]);
    if (skillsRankingState.current_state === SkillsRankingCurrentState.SELF_EVALUATING) {
      setSelectedIndex(null);
      setIsRankSelected(false);
    } else {
      setIsRankSelected(true);
      if (skillsRankingState.self_ranking !== null) {
        setSelectedIndex(OPTIONS.findIndex(option => option.percent === parseInt(skillsRankingState.self_ranking as string)));
      } else {
        setSelectedIndex(null);
      }
    }
  }, [skillsRankingState.current_state, skillsRankingState.experiment_groups.compare_against, skillsRankingState.self_ranking]);

  // Disable buttons if we're not in the self-evaluating state
  const isDisabled = disabled || skillsRankingState.current_state !== SkillsRankingCurrentState.SELF_EVALUATING || isRankSelected;

  const handleRankSelect = (rank: string) => {
    setSelectedIndex(OPTIONS.findIndex(option => option.value === rank));
    setIsRankSelected(true);
    onRankSelect(rank);
  };

  return (
    <Box ref={ref}>
      <MessageContainer origin={ConversationMessageSender.COMPASS} data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_CONTAINER}>
        <ChatBubble message={message} sender={ConversationMessageSender.COMPASS}>
          <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
            <Typography variant="body1" data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_TEXT}>
              {questionText}
            </Typography>
            <Box display="flex" flexDirection="column" alignItems="center" width="100%">
              {/* Top label */}
              <Box display="flex" justifyContent="space-between" width="100%">
                <TopLabel variant="caption" disabled={isDisabled}>
                  0%
                </TopLabel>
                <TopLabel variant="caption" disabled={isDisabled}>
                  100%
                </TopLabel>
              </Box>

              {/* Options */}
              <Box display="flex" alignItems="center" width="100%" sx={{ opacity: isDisabled ? 0.5 : 1 }}>
                {OPTIONS.map((option, index) => (
                  <SkillsRankingVoteItem
                    key={option.value}
                    option={option}
                    index={index}
                    selectedIndex={selectedIndex}
                    hoveredIndex={hoveredIndex}
                    disabled={!isOnline || isDisabled}
                    onSelect={(index: number) => {
                      setSelectedIndex(index);
                      handleRankSelect(option.value);
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
    </Box>
  );
});

export default SkillsRankingVote;
