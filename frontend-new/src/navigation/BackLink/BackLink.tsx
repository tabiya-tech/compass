import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export interface BackLinkProps {
  label: string;
  onClick: () => void;
  isOnline: boolean;
  color?: string;
  dataTestId?: string;
  sx?: Record<string, unknown>;
}

const BackLink: React.FC<BackLinkProps> = ({ label, onClick, isOnline, color = "#FFFFFF", dataTestId, sx }) => {
  const theme = useTheme();

  const baseSx = {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
    cursor: isOnline ? "pointer" : "default",
    color,
    opacity: isOnline ? 0.85 : 0.5,
    textDecoration: "none",
    "&:hover": {
      textDecoration: isOnline ? "underline" : "none",
      opacity: isOnline ? 1 : 0.5,
    },
  };

  return (
    <Box
      onClick={() => {
        if (!isOnline) return;
        onClick();
      }}
      aria-disabled={!isOnline}
      data-testid={dataTestId}
      sx={{ ...baseSx, ...sx }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ArrowBackIcon fontSize="small" sx={{ color }} />
      </Box>
      <Typography variant="body2" sx={{ color, fontWeight: 500 }}>
        {label}
      </Typography>
    </Box>
  );
};

export default BackLink;
