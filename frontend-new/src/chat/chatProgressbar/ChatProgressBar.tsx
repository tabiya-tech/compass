import React from "react";
import { CurrentPhase } from "./types";
import { motion } from "framer-motion";
import { Box, useTheme } from "@mui/material";
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      {/* Phase label + percentage */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box
          data-testid={DATA_TEST_ID.PROGRESS_BAR_PHASE_TEXT}
          sx={{ ...theme.typography.caption, color: theme.palette.text.secondary, lineHeight: 1.5 }}
        >
          {userFriendlyConversationPhaseText}
        </Box>
        <Box
          data-testid={DATA_TEST_ID.PROGRESS_BAR_LABEL}
          sx={{ ...theme.typography.caption, fontWeight: 600, color: theme.palette.primary.main, lineHeight: 1.5 }}
        >
          {percentageInText}
        </Box>
      </Box>

      {/* Track */}
      <Box
        data-testid={DATA_TEST_ID.CONTAINER}
        sx={{
          height: "4px",
          borderRadius: theme.rounding(theme.tabiyaRounding.sm),
          backgroundColor: theme.palette.grey[100],
          overflow: "hidden",
        }}
      >
        <motion.div
          data-testid={DATA_TEST_ID.PROGRESS_BAR}
          style={{
            height: "100%",
            borderRadius: theme.rounding(theme.tabiyaRounding.sm),
            backgroundColor: theme.palette.primary.main,
          }}
          initial={{ width: 0 }}
          animate={{ width: percentageInText }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </Box>
    </Box>
  );
};

export default ChatProgressBar;
