import React, { useEffect, useState } from "react";
import { Box, Typography, keyframes } from "@mui/material";
import { useTranslation } from "react-i18next";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { AnimatePresence, motion } from "framer-motion";

const uniqueId = "7fa5c1d3-8b76-4d9f-a422-f35c91e7a2c8";

export const DATA_TEST_ID = {
  CV_TYPING_CHAT_MESSAGE_CONTAINER: `cv-typing-chat-message-container-${uniqueId}`,
};

// Deprecated: UI_TEXT constants replaced by i18n keys. Keep for backwards compatibility in any legacy imports.
export const UI_TEXT = {
  UPLOADING_CV: "Please wait while I upload and parse your CV",
  CV_UPLOADED: "Your CV content is in the text field. Review it and send when ready.",
};


export const CV_UPLOADED_DISPLAY_TIME = 30 * 1000;

export const CV_TYPING_CHAT_MESSAGE_TYPE = `cv-typing-message-${uniqueId}`;

export interface CVTypingChatMessageProps {
  isUploaded?: boolean;
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

const CVTypingChatMessage: React.FC<CVTypingChatMessageProps> = ({ isUploaded = false }) => {
  const { t, i18n } = useTranslation();
  const displayTextKey = isUploaded ?  "cv.cvTypingChatMessage.uploadedReady" : "cv.cvTypingChatMessage.uploading";
  const [displayText, setDisplayText] = useState(t(displayTextKey));

  useEffect(() => {
    // Update text when language or key changes
    setDisplayText(t(displayTextKey));
  }, [displayTextKey, i18n.language, t]);

  const showDots = !isUploaded;

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
          data-testid={DATA_TEST_ID.CV_TYPING_CHAT_MESSAGE_CONTAINER}
        >
          <ChatBubble message="" sender={ConversationMessageSender.COMPASS}>
            <Box display="flex" alignItems="baseline">
              <Typography>{displayText}</Typography>
              {showDots && (
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
              )}
            </Box>
          </ChatBubble>
        </MessageContainer>
      </motion.div>
    </AnimatePresence>
  );
};

export default CVTypingChatMessage;
