import React from "react";
import { Box, styled, Typography, useTheme } from "@mui/material";
import { getDurationFromNow } from "src/utils/getDurationFromNow/getDurationFromNow";
import ReactionButtons from "src/feedback/reaction/components/reactionButtons/ReactionButtons";
import { ReactionResponse } from "src/chat/ChatService/ChatService.types";

export enum ChatMessageFooterChildren {
  TIMESTAMP = "TIMESTAMP",
  REACTIONS = "REACTIONS",
}

interface ChatMessageFooterProps {
  sentAt: string;
  messageId: string;
  visibleChildren: ChatMessageFooterChildren[];
  currentReaction: ReactionResponse | null;
}

const uniqueId = "8d4e6f2c-9a3b-4c5d-b1e7-5f9d8a2b3c4e";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_FOOTER_CONTAINER: `chat-message-footer-container-${uniqueId}`,
  CHAT_MESSAGE_FOOTER_TIMESTAMP: `chat-message-footer-timestamp-${uniqueId}`,
  CHAT_MESSAGE_FOOTER_REACTIONS: `chat-message-footer-reaction-${uniqueId}`,
};

const TimeStamp = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(theme.tabiyaSpacing.xs),
}));

export const ChatMessageFooter: React.FC<ChatMessageFooterProps> = ({
  sentAt,
  messageId,
  visibleChildren,
  currentReaction,
}) => {
  const theme = useTheme();

  let duration;
  try {
    duration = getDurationFromNow(new Date(sentAt));
  } catch (e) {
    // if a duration cannot be found for some reason, show the date itself
    duration = new Date(sentAt).toString();
    console.error(new Error("Failed to get message duration", { cause: e }));
  }

  const justifyContentValue = visibleChildren.includes(ChatMessageFooterChildren.REACTIONS)
    ? "space-between"
    : "flex-end";

  return (
    <Box
      width={"100%"}
      display="flex"
      flexDirection={"row"}
      justifyContent={justifyContentValue}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
      data-testid={DATA_TEST_ID.CHAT_MESSAGE_FOOTER_CONTAINER}
    >
      {visibleChildren.includes(ChatMessageFooterChildren.TIMESTAMP) && (
        <TimeStamp data-testid={DATA_TEST_ID.CHAT_MESSAGE_FOOTER_TIMESTAMP} variant="caption">
          sent {duration}
        </TimeStamp>
      )}
      {visibleChildren.includes(ChatMessageFooterChildren.REACTIONS) && (
        <Box data-testid={DATA_TEST_ID.CHAT_MESSAGE_FOOTER_REACTIONS}>
          <ReactionButtons messageId={messageId} currentReaction={currentReaction} />
        </Box>
      )}
    </Box>
  );
};

export default ChatMessageFooter;
