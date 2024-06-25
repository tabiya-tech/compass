import React, { useEffect, useRef } from "react";
import { ChatMessageOrigin, IChatMessage } from "src/chat/Chat.types";
import { Box, List, ListItem } from "@mui/material";
import { styled } from "@mui/system";
import ChatMessage from "src/chat/ChatMessage/ChatMessage";
import { motion, AnimatePresence } from "framer-motion";

const uniqueId = "0397ee51-f637-4453-9e2f-5cc8900c9554";
export const DATA_TEST_ID = {
  CHAT_LIST_CONTAINER: `chat-list-container-${uniqueId}`,
};

export type ChatListProps = {
  messages: IChatMessage[];
  sendMessage: (message: string) => void;
  clearMessages: () => void;
  isTyping: boolean;
};

const ChatListContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  [theme.breakpoints.up("md")]: {
    height: "90%",
    width: "80%",
    margin: "auto",
  },
}));

const MessagesContainer = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  overflowY: "auto",
  padding: theme.spacing(2),
}));

const ChatList: React.FC<ChatListProps> = ({ messages, clearMessages, sendMessage, isTyping }) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const loadingMessage: IChatMessage = {
    id: -1,
    message: "Typing...",
    origin: ChatMessageOrigin.COMPASS,
    timestamp: Date.now(),
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <ChatListContainer data-testid={DATA_TEST_ID.CHAT_LIST_CONTAINER}>
      <MessagesContainer>
        <List
          sx={{
            width: "100%",
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
                transition={{ duration: 0.3 }}
                sx={{ width: "100%" }}
              >
                <ChatMessage chatMessage={message} />
              </ListItem>
            ))}
            {isTyping && (
              <ListItem
                component={motion.li}
                key="typing"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={messageVariants}
                transition={{ duration: 0.3 }}
                sx={{ width: "100%" }}
              >
                <ChatMessage chatMessage={loadingMessage} />
              </ListItem>
            )}
          </AnimatePresence>
        </List>
        <div ref={messagesEndRef} />
      </MessagesContainer>
    </ChatListContainer>
  );
};

export default ChatList;
