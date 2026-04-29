import React from "react";
import { Box, Tooltip, useTheme } from "@mui/material";
import type { TooltipProps } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const uniqueId = "8d2f7c44-3b1a-4d9e-8c6e-9a2b1f0e5d7a";

export const DATA_TEST_ID = {
  CONTAINER: `${uniqueId}-container`,
  ICON: `${uniqueId}-icon`,
};

export interface MetricInfoIconProps {
  title: string;
  placement?: TooltipProps["placement"];
  iconSize?: number;
  ariaLabel?: string;
}

/**
 * Inline information icon paired with an MUI Tooltip. Used next to metric
 * titles (KPI cards, chart titles) to surface a short explanation of what
 * the metric measures. Keyboard-focusable so AT users can trigger the
 * tooltip via Tab; tap-to-show on mobile via `enterTouchDelay={0}`.
 */
const MetricInfoIcon: React.FC<MetricInfoIconProps> = ({ title, placement = "top", iconSize = 16, ariaLabel }) => {
  const theme = useTheme();

  return (
    <Tooltip title={title} placement={placement} arrow enterTouchDelay={0} leaveTouchDelay={4000}>
      <Box
        component="span"
        role="img"
        tabIndex={0}
        aria-label={ariaLabel ?? title}
        data-testid={DATA_TEST_ID.CONTAINER}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          color: theme.palette.text.secondary,
          cursor: "help",
          lineHeight: 0,
          borderRadius: "50%",
          "&:focus-visible": {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: iconSize }} data-testid={DATA_TEST_ID.ICON} />
      </Box>
    </Tooltip>
  );
};

export default MetricInfoIcon;
