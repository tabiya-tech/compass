import React from "react";
import { Theme, useTheme } from "@mui/material/styles";
import { Divider, useMediaQuery, Box, styled, Typography } from "@mui/material";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import { getBackgroundColor, getBorderStyle, getDividerColor } from "src/features/skillsRanking/utils/utils";

const uniqueId = "5271610c-0000-4000-8000-000000000000";

export const DATA_TEST_ID = {
  SKILLS_RANKING_VOTE_ITEM: `skills-ranking-vote-item-${uniqueId}`,
  SKILLS_RANKING_VOTE_ITEM_RADIO: `skills-ranking-vote-item-radio-${uniqueId}`,
  SKILLS_RANKING_VOTE_ITEM_DIVIDER: `skills-ranking-vote-item-divider-${uniqueId}`,
  SKILLS_RANKING_VOTE_ITEM_TOP_LABEL: `skills-ranking-vote-item-top-label-${uniqueId}`,
  SKILLS_RANKING_VOTE_ITEM_BOTTOM_LABEL: `skills-ranking-vote-item-bottom-label-${uniqueId}`,
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
  showTopLabel?: boolean;
  showBottomLabel?: boolean;
}

const OptionLabel = styled(Typography)<{ selected: boolean }>(({ theme, selected }) => ({
  color: theme.palette.grey[600],
  fontSize: theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.2),
  fontWeight: selected ? "bold" : "normal",
  whiteSpace: "nowrap",
}));

const SkillsRankingVoteItem: React.FC<SkillsRankingVoteItemProps> = ({
  option,
  index,
  selectedIndex,
  hoveredIndex,
  disabled,
  onSelect,
  onHover,
  isLast,
  showTopLabel,
  showBottomLabel,
}) => {
  const theme = useTheme();
  const styleParams = { index, selectedIndex, hoveredIndex, disabled };
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  return (
    <Box
      data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM}
      display="flex"
      alignItems="center"
      width={isLast ? "auto" : "100%"}
    >
      <Box
        position="relative"
        display="flex"
        alignItems="center"
        flexDirection="column"
        sx={{
          opacity: disabled && selectedIndex !== index ? 0.5 : 1,
        }}
      >
        <Box
          sx={{ position: "absolute", top: -15, width: "max-content" }}
          data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_TOP_LABEL}
        >
          {showTopLabel && <OptionLabel selected={selectedIndex === index}>{option.value}</OptionLabel>}
        </Box>
        <PrimaryIconButton
          aria-label={option.value}
          onClick={() => onSelect(index)}
          onMouseEnter={() => onHover(index)}
          onMouseLeave={() => onHover(null)}
          disabled={disabled}
          sx={{ p: 0, minWidth: 0, minHeight: 0, borderRadius: "50%" }}
          data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_RADIO}
        >
          <span
            style={{
              display: "block",
              width: isSmallMobile ? 20 : 24,
              height: isSmallMobile ? 20 : 24,
              borderRadius: "50%",
              background: getBackgroundColor(styleParams, theme),
              border: getBorderStyle(styleParams, theme),
            }}
          />
        </PrimaryIconButton>
        <Box
          sx={{ position: "absolute", bottom: -15, width: "max-content" }}
          data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_BOTTOM_LABEL}
        >
          {showBottomLabel && <OptionLabel selected={selectedIndex === index}>{option.value}</OptionLabel>}
        </Box>
      </Box>
      {!isLast && (
        <Divider
          sx={{
            flex: 1,
            background: getDividerColor(styleParams, theme),
            borderWidth: 1,
            opacity: disabled ? 0.5 : 1,
          }}
          data-testid={DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_DIVIDER}
        />
      )}
    </Box>
  );
};

export default SkillsRankingVoteItem;
