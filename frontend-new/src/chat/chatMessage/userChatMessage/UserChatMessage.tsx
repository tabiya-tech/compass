import React from "react";
import { Box, styled } from "@mui/material";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";

const uniqueId = "41e9f8a5-be6f-406a-9958-13e9bcc853a9";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_CONTAINER: `chat-message-container-${uniqueId}`,
};

export const MessageContainer = styled(Box)<{ origin: ConversationMessageSender }>(({ theme, origin }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: origin === ConversationMessageSender.USER ? "flex-end" : "flex-start",
  marginBottom: theme.spacing(theme.tabiyaSpacing.sm),
  width: "100%",
}));

type BasicChatMessageProps = {
  chatMessage: IChatMessage;
};

const UserChatMessage: React.FC<BasicChatMessageProps> = ({ chatMessage }) => {
  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}>
      <Box
        sx={{
          maxWidth: "80%",
          minWidth: "30%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ChatBubble message={chatMessage.message} sender={chatMessage.sender} />
        <ChatMessageFooterLayout sender={chatMessage.sender}>
          <Timestamp sentAt={chatMessage.sent_at} />
        </ChatMessageFooterLayout>
      </Box>
    </MessageContainer>
  );
};

export default UserChatMessage;
