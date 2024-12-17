import React from "react";
import { Box } from "@mui/material";

export enum ChatMessageFooterChildren {
  TIMESTAMP = "TIMESTAMP",
  REACTIONS = "REACTIONS",
}

interface ChatMessageFooterProps {
  sentAt: string;
  messageId: string;
  visibleChildren: ChatMessageFooterChildren[];
  currentReaction: string;
  notifyReactionChange: (messageId: string, reaction: string) => void;
  dataTestId: string;
}

const uniqueId = "8d4e6f2c-9a3b-4c5d-b1e7-5f9d8a2b3c4e";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_FOOTER_TIMESTAMP: `chat-message-footer-timestamp-${uniqueId}`,
  CHAT_MESSAGE_FOOTER_REACTIONS: `chat-message-footer-reaction-${uniqueId}`,
};

export const ChatMessageFooter: React.FC<ChatMessageFooterProps> = ({
  sentAt,
  messageId,
  currentReaction,
  notifyReactionChange,
  ...props
}) => {
  // Implement getting duration from now
  return (
    <Box display="flex" gap={1} data-testid={props["dataTestId"]}>
      {/* Implement showing timestamp and reactions based on the visible children */}
    </Box>
  );
};

export default ChatMessageFooter;
