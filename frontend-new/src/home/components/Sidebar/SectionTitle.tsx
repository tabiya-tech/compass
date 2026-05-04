import React from "react";
import { Box, useTheme } from "@mui/material";

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        ...theme.typography.h2,
        fontWeight: 700,
        fontSize: "1.5rem",
        lineHeight: 0.9,
        letterSpacing: "-0.02em",
        color: theme.palette.text.secondary,
        marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
      }}
    >
      {children}
    </Box>
  );
};

export default SectionTitle;
