import React, { useEffect, useRef } from "react";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";
import { Box, List, ListItem, useTheme } from "@mui/material";
import { styled } from "@mui/system";
import BasicChatMessage from "src/chat/chatMessage/basicChatMessage/BasicChatMessage";
import { motion, AnimatePresence } from "framer-motion";
import ConversationConclusionChatMessage
  from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";

const uniqueId = "0397ee51-f637-4453-9e2f-5cc8900c9554";
export const DATA_TEST_ID = {
  CHAT_LIST_CONTAINER: `chat-list-container-${uniqueId}`,
};

export type ChatListProps = {
  messages: IChatMessage[];
  notifyOnFeedbackFormOpened: () => void;
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

const ChatList: React.FC<ChatListProps> = ({ messages, notifyOnFeedbackFormOpened }) => {
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
  
  const getChatMessageFlavorFromType = (chatMessage: IChatMessage)  => {
    switch (chatMessage.type) {
      case ChatMessageType.BASIC_CHAT:
        return <BasicChatMessage chatMessage={chatMessage} />;
      case ChatMessageType.CONVERSATION_CONCLUSION:
        return (
          <ConversationConclusionChatMessage
            chatMessage={chatMessage}
            notifyOnFeedbackFormOpened={notifyOnFeedbackFormOpened}
          />
        );
      case ChatMessageType.TYPING:
        // typing messages don't need to show anything but the message text
        // no timestamp or reactions will be shown, so we can use the ChatBubble itself
        return <ChatBubble message={chatMessage.message} sender={chatMessage.sender} />
    }
  }

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
              key={message.id}
              component={motion.li}
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={messageVariants}
              disablePadding={true}
              transition={{ duration: 0.3 }}
              sx={{ width: "100%", padding: theme.tabiyaSpacing.xs }}
            >
              { getChatMessageFlavorFromType(message) }
            </ListItem>
          ))}
        </AnimatePresence>
      </List>
      <div ref={messagesEndRef} />
    </ChatListContainer>
  );
};

export default ChatList;
