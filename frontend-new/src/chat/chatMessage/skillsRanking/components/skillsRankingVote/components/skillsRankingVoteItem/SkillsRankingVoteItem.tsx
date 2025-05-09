import React from "react";
import { Theme, useTheme } from "@mui/material/styles";
import { Tooltip, Divider, useMediaQuery } from "@mui/material";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import {
  getBackgroundColor,
  getBorderStyle,
  getDividerColor,
} from "src/chat/chatMessage/skillsRanking/components/skillsRankingVote/utils";

const uniqueId = "5271610c-0000-4000-8000-000000000000";

export const DATA_TEST_ID = {
  SKILLS_RANKING_VOTE_ITEM: `skills-ranking-vote-item-${uniqueId}`,
  SKILLS_RANKING_VOTE_ITEM_RADIO: `skills-ranking-vote-item-radio-${uniqueId}`,
  SKILLS_RANKING_VOTE_ITEM_DIVIDER: `skills-ranking-vote-item-divider-${uniqueId}`,
};

interface SkillsRankingVoteItemProps {
  option: { value: string; percent: number };
  index: number;
  selectedIndex: number | null;
  hoveredIndex: number | null;
  disabled: boolean;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
  isLast: boolean;
}

const SkillsRankingVoteItem: React.FC<SkillsRankingVoteItemProps> = ({
  option,
  index,
  selectedIndex,
  hoveredIndex,
  disabled,
  onSelect,
  onHover,
  isLast,
}) => {
  const theme = useTheme();
  const styleParams = { index, selectedIndex, hoveredIndex, disabled };
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  return (
    <React.Fragment data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM}>
      <Tooltip title={option.value} placement="top">
        <PrimaryIconButton
          aria-label={option.value}
          onClick={() => onSelect(index)}
          onMouseEnter={() => onHover(index)}
          onMouseLeave={() => onHover(null)}
          disabled={disabled}
          // 50 % to create a circle.
          sx={{ p: 0, minWidth: 0, minHeight: 0, borderRadius: "50%" }}
          data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_RADIO}
        >
          <span
            style={{
              display: "block",
              width: isSmallMobile ? 20 : 24,
              height: isSmallMobile ? 20 : 24,
              // 50% to create a circle.
              borderRadius: "50%",
              background: getBackgroundColor(styleParams, theme),
              border: getBorderStyle(styleParams, theme),
            }}
          />
        </PrimaryIconButton>
      </Tooltip>
      {!isLast && (
        <Divider
          sx={{
            flex: 1,
            background: getDividerColor(styleParams, theme),
            borderWidth: 1,
          }}
          data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_DIVIDER}
        />
      )}
    </React.Fragment>
  );
};

export default SkillsRankingVoteItem;
