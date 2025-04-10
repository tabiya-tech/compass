import React from "react";
import { CurrentPhase } from "./types";
import { motion } from "framer-motion";
import { Box, useTheme, Typography } from "@mui/material";
import { getUserFriendlyConversationPhaseName } from "./getUserFriendlyConversationPhaseName";

const uniqueId = "2a76494f-351d-409d-ba58-e1b2cfaf2a53";

export const DATA_TEST_ID = {
  CONTAINER: `chat-progress-bar-container-${uniqueId}`,
  PROGRESS_BAR: `chat-progress-bar-${uniqueId}`,
  PROGRESS_BAR_PHASE_TEXT: `chat-progress-bar-text-${uniqueId}`,
  PROGRESS_BAR_LABEL: `chat-progress-bar-label-${uniqueId}`,
};

const ChatProgressBar: React.FC<CurrentPhase> = (currentPhase) => {
  const theme = useTheme();
  const percentageInText = `${currentPhase.percentage}%`;
  const userFriendlyConversationPhaseText = getUserFriendlyConversationPhaseName(currentPhase);

  return (
    <Box sx={{
      display: "flex",
      flexDirection: "column",
      gap: theme.fixedSpacing(theme.tabiyaSpacing.xs),
      // to match the width of the message list container
      [theme.breakpoints.up("md")]: {
        width: "60%",
        margin: "auto",
      },
    }}>
      <Box
        data-testid={DATA_TEST_ID.CONTAINER}
        sx={{
          overflow: "hidden",
          fontSize: theme.typography.overline.fontSize,
          width: "100%",
          backgroundColor: theme.palette.common.white,
          borderRadius: theme.rounding(theme.tabiyaRounding.xs),
          border: `1px solid ${theme.palette.grey[300]}`,
          display: "grid",
          placeItems: "center start",
        }}
      >
        <motion.div
          style={{
            backgroundColor: theme.palette.primary.main,
            height: "100%",gridRow: 1,
            borderRadius: theme.rounding(theme.tabiyaRounding.xs),
            gridColumn: 1
          }}
          initial={{
            width: 0,
          }}
          animate={{
            width: percentageInText,
          }}
          data-testid={DATA_TEST_ID.PROGRESS_BAR}
          transition={{
            duration: 0.5,
            ease: "easeOut",
          }}
        />
        <Box
          sx={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
            paddingX: theme.fixedSpacing(theme.tabiyaSpacing.sm),
            paddingY: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
            gridRow: 1,
            gridColumn: 1
          }}
        >
          <Typography variant="progressBarText" lineHeight={1} data-testid={DATA_TEST_ID.PROGRESS_BAR_PHASE_TEXT}>{userFriendlyConversationPhaseText}</Typography>
          <Box data-testid={DATA_TEST_ID.PROGRESS_BAR_LABEL}>{percentageInText}</Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatProgressBar;
