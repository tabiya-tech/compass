import React, { ReactNode } from "react";
import { Box } from "@mui/material";

interface MessageFooterProps {
  children: ReactNode;
}

const uniqueId = "74bf72e8-1ed8-4dcf-8d3a-262d82cdd4b2";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_FOOTER_CONTAINER: `chat-message-footer-container-${uniqueId}`,
};

const ChatMessageFooter: React.FC<MessageFooterProps> = ({ children }) => {
  return (
    <Box data-testid={DATA_TEST_ID.CHAT_MESSAGE_FOOTER_CONTAINER}>
      {children}
    </Box>
  );
};

export default ChatMessageFooter;
