import React, { useEffect, useRef } from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { Box, List, ListItem, useTheme } from "@mui/material";
import { styled } from "@mui/system";
import { AnimatePresence, motion } from "framer-motion";

const uniqueId = "0397ee51-f637-4453-9e2f-5cc8900c9554";
export const DATA_TEST_ID = {
  CHAT_LIST_CONTAINER: `chat-list-container-${uniqueId}`,
};

export type ChatListProps = {
  messages: IChatMessage<any>[];
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

const ChatList: React.FC<ChatListProps> = ({ messages }) => {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      // we are making scrollIntoView optionally called,
      // because in jest (jsdom) scrollIntoView is not a function
      // as jest jsdom doesn't have any view.
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
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
    if (messagesEndRef.current) {
      // Scroll to the bottom of the chat message
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }

  useEffect(() => {
    window.addEventListener("resize", resizeChatMessage);
    return () => window.removeEventListener("resize", resizeChatMessage);
  }, []);

  return (
    <ChatListContainer data-testid={DATA_TEST_ID.CHAT_LIST_CONTAINER} tabIndex={0}>
      <List
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          margin: 0,
          gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
        }}
      >
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <ListItem
              key={message.message_id}
              component={motion.li}
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={messageVariants}
              disablePadding={true}
              transition={{ duration: 0.3 }}
              sx={{ width: "100%", paddingY: theme.tabiyaSpacing.xs, paddingX: 0 }}
            >
              {message.component(message.payload)}
            </ListItem>
          ))}
        </AnimatePresence>
      </List>
      <div ref={messagesEndRef} />
    </ChatListContainer>
  );
};

export default ChatList;
