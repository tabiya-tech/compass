import React, { useEffect, useState } from "react";
import { Box, keyframes, Typography, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { AnimatePresence, motion } from "framer-motion";
import CustomLink from "src/theme/CustomLink/CustomLink";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";

const uniqueId = "6cbdaa24-09da-4c18-907c-7d98d210d2e9";

export const DATA_TEST_ID = {
  CANCELLABLE_TYPING_CHAT_MESSAGE_CONTAINER: `cancellable-typing-chat-message-container-${uniqueId}`,
  CANCEL_BUTTON: `cancellable-typing-chat-message-cancel-button-${uniqueId}`,
};

export const UI_TEXT = {
  TYPING: "Typing",
  THINKING: "Please wait, this might take a while",
  CANCEL: "Cancel",
};

export const WAIT_BEFORE_THINKING = 15000;

export interface CancellableTypingChatMessageProps {
  message?: string;
  thinkingMessage?: string;
  waitBeforeThinking?: number;
  disabled?: boolean;
  onCancel: () => Promise<void>;
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

const StyledCustomLink: React.FC<React.ComponentProps<typeof CustomLink>> = (props) => {
  const theme = useTheme();
  return (
    <CustomLink
      {...props}
      style={{
        display: "inline-flex",
        flexDirection: "row",
        gap: theme.spacing(theme.tabiyaSpacing.xxs),
        verticalAlign: "bottom",
        ...props.style,
      }}
    />
  );
};

const CancellableTypingChatMessage: React.FC<CancellableTypingChatMessageProps> = ({
  message = UI_TEXT.TYPING,
  thinkingMessage = UI_TEXT.THINKING,
  waitBeforeThinking = WAIT_BEFORE_THINKING,
  disabled = false,
  onCancel,
}) => {
  const [displayText, setDisplayText] = useState(message);
  const theme = useTheme();

  useEffect(() => {
    // Change text after waitBeforeThinking duration
    const textChangeTimer = setTimeout(() => {
      setDisplayText(thinkingMessage);
    }, waitBeforeThinking);

    return () => {
      clearTimeout(textChangeTimer);
    };
  }, [waitBeforeThinking, thinkingMessage]);

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
          data-testid={DATA_TEST_ID.CANCELLABLE_TYPING_CHAT_MESSAGE_CONTAINER}
        >
          <ChatBubble message="" sender={ConversationMessageSender.COMPASS}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              width="100%"
              gap={theme.spacing(theme.tabiyaSpacing.md)}
            >
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
              <StyledCustomLink onClick={onCancel} disabled={disabled} data-testid={DATA_TEST_ID.CANCEL_BUTTON}>
                <HighlightOffIcon />
                {UI_TEXT.CANCEL}
              </StyledCustomLink>
            </Box>
          </ChatBubble>
        </MessageContainer>
      </motion.div>
    </AnimatePresence>
  );
};

export default CancellableTypingChatMessage;
