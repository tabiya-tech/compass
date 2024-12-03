import React, { ReactNode } from "react";
import { Box, Divider, useTheme } from "@mui/material";

interface MessageFooterProps {
  children: ReactNode;
}

const uniqueId = "74bf72e8-1ed8-4dcf-8d3a-262d82cdd4b2";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_FOOTER: `chat-message-footer-${uniqueId}`,
  CHAT_MESSAGE_FOOTER_DIVIDER: `chat-message-footer-divider-${uniqueId}`,
};

const ChatMessageFooter: React.FC<MessageFooterProps> = ({ children }) => {
  const theme = useTheme();

  return (
    <Box data-testid={DATA_TEST_ID.CHAT_MESSAGE_FOOTER}>
      <Divider
        color={theme.palette.grey[100]}
        sx={{ marginY: theme.spacing(1) }}
        data-testid={DATA_TEST_ID.CHAT_MESSAGE_FOOTER_DIVIDER}
      />
      {children}
    </Box>
  );
};

export default ChatMessageFooter;
