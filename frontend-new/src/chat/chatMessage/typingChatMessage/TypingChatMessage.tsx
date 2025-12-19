import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, keyframes, Typography } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { AnimatePresence, motion } from "framer-motion";

const uniqueId = "eb14a7aa-b515-4ab9-9829-8110346d9090";

export const DATA_TEST_ID = {
  TYPING_CHAT_MESSAGE_CONTAINER: `typing-chat-message-container-${uniqueId}`,
};

export const UI_TEXT_KEYS = {
  // i18n keys
  TYPING: "chat.chatMessage.typingChatMessage.typing",
  THINKING: "chat.chatMessage.typingChatMessage.thinking",
} as const;

export const WAIT_BEFORE_THINKING = 15000;

export const TYPING_CHAT_MESSAGE_TYPE = `typing-message-${uniqueId}`;

export interface TypingChatMessageProps {
  waitBeforeThinking?: number;
}

const dotAnimation = keyframes`
    0%, 100% {
        transform: translateY(+0.5px);
        opacity: 0.5;
    }
    50% {
        transform: translateY(-1px);
        opacity: 1;
    }
`;

const textVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const TypingChatMessage: React.FC<TypingChatMessageProps> = ({ waitBeforeThinking = WAIT_BEFORE_THINKING }) => {
  const { t } = useTranslation();
  const [displayText, setDisplayText] = useState(t(UI_TEXT_KEYS.TYPING));

  useEffect(() => {
    // Change text after waitBeforeThinking duration
    const textChangeTimer = setTimeout(() => {
      setDisplayText(t(UI_TEXT_KEYS.THINKING));
    }, waitBeforeThinking,t);

    return () => {
      clearTimeout(textChangeTimer);
    };
  }, [waitBeforeThinking,t]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={displayText}
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={textVariants}
        transition={{ duration: 0.3 }}
      >
        <MessageContainer
          origin={ConversationMessageSender.COMPASS}
          data-testid={DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER}
        >
          <ChatBubble message="" sender={ConversationMessageSender.COMPASS}>
            <Box display="flex" alignItems="baseline">
              <Typography>{displayText}</Typography>
              <Box component="span" paddingLeft={"1px"}>
                {[0, 1, 2].map((i) => (
                  <Typography
                    key={i}
                    component="span"
                    sx={{
                      display: "inline-block",
                      fontSize: "1.5rem",
                      lineHeight: 0,
                      animation: `${dotAnimation} 1.3s infinite ease-in-out`,
                      animationDelay: `${i * 0.2}s`,
                    }}
                  >
                    .
                  </Typography>
                ))}
              </Box>
            </Box>
          </ChatBubble>
        </MessageContainer>
      </motion.div>
    </AnimatePresence>
  );
};

export default TypingChatMessage;
