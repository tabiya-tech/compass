import React from "react";
import { Box, useTheme } from "@mui/material";

const uniqueId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export const DATA_TEST_ID = {
  SIDEBAR_CONTAINER: `sidebar-container-${uniqueId}`,
  SIDEBAR_TITLE: `sidebar-title-${uniqueId}`,
  SIDEBAR_CONTENT: `sidebar-content-${uniqueId}`,
};

export interface SidebarProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  width?: number | string;
  disablePadding?: boolean;
}

/**
 * Generic sidebar shell — handles layout, scroll, border, spacing, and title style.
 * Domain-specific content is passed via children.
 */
const Sidebar: React.FC<SidebarProps> = ({ title, children, width = 280, disablePadding = false }) => {
  const theme = useTheme();

  return (
    <Box
      component="aside"
      data-testid={DATA_TEST_ID.SIDEBAR_CONTAINER}
      sx={{
        width,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderLeft: "none",
        overflowY: "auto",
        padding: disablePadding
          ? 0
          : `${theme.fixedSpacing(theme.tabiyaSpacing.md * 1.125)} ${theme.fixedSpacing(theme.tabiyaSpacing.md)}`,
        gap: theme.fixedSpacing(theme.tabiyaSpacing.lg * 1.25),
      }}
    >
      {title && (
        <Box
          data-testid={DATA_TEST_ID.SIDEBAR_TITLE}
          sx={{
            ...theme.typography.body2,
            fontWeight: 700,
            color: theme.palette.common.black,
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </Box>
      )}
      <Box
        data-testid={DATA_TEST_ID.SIDEBAR_CONTENT}
        sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.lg * 1.25) }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Sidebar;
