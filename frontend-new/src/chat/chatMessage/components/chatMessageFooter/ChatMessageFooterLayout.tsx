import React from "react";
import { Box } from "@mui/material";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

const uniqueId = "7772f20a-9d0c-4072-b24f-97eca2f43d7b";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_FOOTER_LAYOUT_CONTAINER: `chat-message-footer-layout-container-${uniqueId}`,
};

export interface ChatMessageFooterLayoutProps {
  sender: ConversationMessageSender;
  children: React.ReactNode;
}

const ChatMessageFooterLayout: React.FC<ChatMessageFooterLayoutProps> = ({ sender, children }) => {
  return (
    <Box
      data-testid={DATA_TEST_ID.CHAT_MESSAGE_FOOTER_LAYOUT_CONTAINER}
      width="100%"
      display="flex"
      flexDirection={sender === ConversationMessageSender.COMPASS ? "row" : "row-reverse"}
      padding={(theme) => theme.fixedSpacing(theme.tabiyaSpacing.xs)}
      justifyContent={"space-between"}
      gap={(theme) => theme.fixedSpacing(theme.tabiyaSpacing.sm)}
    >
      {children}
    </Box>
  );
};

export default ChatMessageFooterLayout;
