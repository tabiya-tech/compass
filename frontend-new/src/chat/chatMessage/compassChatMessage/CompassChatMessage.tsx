import React from "react";
import { Box, styled } from "@mui/material";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import ChatMessageFooter, {
  ChatMessageFooterChildren,
} from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooter";

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
      <Box
        sx={{
          maxWidth: "80%",
          minWidth: "30%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ChatBubble message={chatMessage.message} sender={chatMessage.sender} />
        <ChatMessageFooter
          sentAt={chatMessage.sent_at}
          messageId={chatMessage.message_id}
          currentReaction={chatMessage.reaction}
          visibleChildren={[ChatMessageFooterChildren.TIMESTAMP, ChatMessageFooterChildren.REACTIONS]}
        />
      </Box>
    </MessageContainer>
  );
};

export default CompassChatMessage;
