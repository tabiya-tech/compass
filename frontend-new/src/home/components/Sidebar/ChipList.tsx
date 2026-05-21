import React, { useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

const COLLAPSE_AFTER = 8;

export interface ChipListProps {
  chips: string[];
  chipBgColor: string;
  chipTextColor: string;
  accentColor: string;
  emptyText: string;
  emptyTestId: string;
  chipTestId: string;
  expandButtonTestId: string;
}

const ChipList: React.FC<ChipListProps> = ({
  chips,
  chipBgColor,
  chipTextColor,
  accentColor,
  emptyText,
  emptyTestId,
  chipTestId,
  expandButtonTestId,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasMore = chips.length > COLLAPSE_AFTER;
  const visibleChips = hasMore && !expanded ? chips.slice(0, COLLAPSE_AFTER) : chips;

  const handleExpandToggle = () => setExpanded((prev) => !prev);

  if (chips.length === 0) {
    return (
      <Box
        data-testid={emptyTestId}
        sx={{
          ...theme.typography.caption,
          lineHeight: 1.5,
          color: theme.palette.text.secondary,
        }}
      >
        {emptyText}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: theme.fixedSpacing(theme.tabiyaSpacing.xs * 1.5) }}>
        {visibleChips.map((label, i) => (
          <Box
            key={i}
            data-testid={chipTestId}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xs * 1.25)} ${theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.5)}`,
              borderRadius: theme.rounding(theme.tabiyaRounding.lg),
              ...theme.typography.body2,
              fontWeight: 400,
              lineHeight: 1.4,
              backgroundColor: chipBgColor,
              color: chipTextColor,
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
      {hasMore && (
        <Box
          component="button"
          data-testid={expandButtonTestId}
          onClick={handleExpandToggle}
          sx={{
            background: "none",
            border: "none",
            padding: 0,
            marginTop: theme.fixedSpacing(theme.tabiyaSpacing.sm),
            cursor: "pointer",
            color: accentColor,
            ...theme.typography.caption,
            fontWeight: 500,
            textAlign: "left",
            width: "fit-content",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {expanded ? t("home.sidebar.showLess") : t("home.sidebar.seeAll", { count: chips.length })}
        </Box>
      )}
    </Box>
  );
};

export default ChipList;
