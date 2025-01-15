import React, { useEffect, useRef } from "react";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";
import { Box, List, ListItem, useTheme } from "@mui/material";
import { styled } from "@mui/system";
import { AnimatePresence, motion } from "framer-motion";
import ConversationConclusionChatMessage from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import UserChatMessage from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import CompassChatMessage from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";

const uniqueId = "0397ee51-f637-4453-9e2f-5cc8900c9554";
export const DATA_TEST_ID = {
  CHAT_LIST_CONTAINER: `chat-list-container-${uniqueId}`,
};

export type ChatListProps = {
  messages: IChatMessage[];
};

const ChatListContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflowX: "hidden",
  flexGrow: 1,
  overflowY: "auto",
  [theme.breakpoints.up("md")]: {
    width: "60%",
    margin: "auto",
  },
}));

const ChatList: React.FC<ChatListProps> = ({
  messages,
}) => {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      // we are making scrollIntoView optionally called,
      // because in jest (jsdom) scrollIntoView is not a function
      // as jest jsdom doesn't have any view.
      messagesEndRef.current.scrollIntoView?.({ behavior: "smooth" });
    }
  }, [messages]);

  const messageVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  /**
   * Resize the chat message when the window is resized,
   * Reason: on mobile devices when keyboard is opened the chat message is not resized, we should scroll to the bottom of the chat message
   * @mdndocs dsad
   */
  function resizeChatMessage() {
    // Scroll to the bottom of the chat message
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    window.addEventListener("resize", resizeChatMessage);
    return () => window.removeEventListener("resize", resizeChatMessage);
  }, []);

  const getChatMessageFlavorFromType = (chatMessage: IChatMessage) => {
    switch (chatMessage.type) {
      case ChatMessageType.BASIC_CHAT:
        if (chatMessage.sender === ConversationMessageSender.USER) {
          return <UserChatMessage chatMessage={chatMessage} />;
        } else {
          return <CompassChatMessage chatMessage={chatMessage} />;
        }
      case ChatMessageType.CONVERSATION_CONCLUSION:
        return (
          <ConversationConclusionChatMessage
            chatMessage={chatMessage}
          />
        );
      case ChatMessageType.TYPING:
      case ChatMessageType.ERROR:
        // typing and error messages don't need to show anything but the message text
        // no timestamp or reactions will be shown, so we can use the ChatBubble itself
        return <ChatBubble message={chatMessage.message} sender={chatMessage.sender} />;
    }
  };

  return (
    <ChatListContainer data-testid={DATA_TEST_ID.CHAT_LIST_CONTAINER} tabIndex={0}>
      <List
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
        }}
      >
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <ListItem
              key={message.message_id}
              component={motion.li}
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={messageVariants}
              disablePadding={true}
              transition={{ duration: 0.3 }}
              sx={{ width: "100%", padding: theme.tabiyaSpacing.xs }}
            >
              {getChatMessageFlavorFromType(message)}
            </ListItem>
          ))}
        </AnimatePresence>
      </List>
      <div ref={messagesEndRef} />
    </ChatListContainer>
  );
};

export default ChatList;
