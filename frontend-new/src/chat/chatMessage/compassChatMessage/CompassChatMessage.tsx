import React from "react";
import { Box, styled } from "@mui/material";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import ReactionButtons from "src/chat/reaction/components/reactionButtons/ReactionButtons";

const uniqueId = "2fbaf2ef-9eab-485a-bd28-b4a164e18b06";

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

type CompassChatMessageProps = {
  chatMessage: IChatMessage;
};

const CompassChatMessage: React.FC<CompassChatMessageProps> = ({ chatMessage }) => {
  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}>
      <Box sx={{
        width: "fit-content",
        minWidth: "30%",
        maxWidth: "80%",
        display: "flex",
        flexDirection: "column",
        alignItems: chatMessage.sender === ConversationMessageSender.COMPASS ? "flex-start" : "flex-end"
      }}>
        <Box sx={{ width: "100%" }}>
          <ChatBubble message={chatMessage.message} sender={chatMessage.sender} />
          <ChatMessageFooterLayout sender={chatMessage.sender}>
            <Timestamp sentAt={chatMessage.sent_at} />
            <ReactionButtons
              messageId={chatMessage.message_id}
              currentReaction={chatMessage.reaction}
            />
          </ChatMessageFooterLayout>
        </Box>
      </Box>
    </MessageContainer>
  );
};

export default CompassChatMessage;
