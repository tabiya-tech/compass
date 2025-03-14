import React, { useEffect, useState } from "react";
import { Box, Typography, keyframes } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

const uniqueId = "eb14a7aa-b515-4ab9-9829-8110346d9090";

export const DATA_TEST_ID = {
  TYPING_CHAT_MESSAGE_CONTAINER: `typing-chat-message-container-${uniqueId}`,
};

export const UI_TEXT = {
  TYPING: "Typing",
  THINKING: "Please wait, I'm thinking",
};

export const WAIT_BEFORE_THINKING = 15000;

export interface TypingChatMessageProps {
  waitBeforeThinking?: number;
}

const dotAnimation = keyframes`
  0%, 100% { transform: translateY(0); opacity: 0.5; }
  50% { transform: translateY(-2px); opacity: 1; }
`;

const TypingChatMessage: React.FC<TypingChatMessageProps> = ({ waitBeforeThinking = WAIT_BEFORE_THINKING }) => {
  const [displayText, setDisplayText] = useState(UI_TEXT.TYPING);

  useEffect(() => {
    // Change text after waitBeforeThinking duration
    const textChangeTimer = setTimeout(() => {
      setDisplayText(UI_TEXT.THINKING);
    }, waitBeforeThinking);

    return () => {
      clearTimeout(textChangeTimer);
    };
  }, [waitBeforeThinking]);

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER}
    >
      <ChatBubble message="" sender={ConversationMessageSender.COMPASS}>
        <Box display="flex" alignItems="baseline">
          <Typography>{displayText}</Typography>
          <Box component="span">
            {[0, 1, 2].map((i) => (
              <Typography
                key={i}
                component="span"
                sx={{
                  display: "inline-block",
                  fontSize: "1.5rem",
                  lineHeight: 0,
                  animation: `${dotAnimation} 0.8s infinite ease-in-out`,
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
  );
};

export default TypingChatMessage;
