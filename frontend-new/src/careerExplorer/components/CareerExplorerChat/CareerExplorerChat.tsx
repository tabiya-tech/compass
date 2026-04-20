import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material";
import ChatPage from "src/chat/ChatPage/ChatPage";
import CareerExplorerSidebar from "src/home/components/Sidebar/CareerExplorerSidebar";
import { generateUserMessage } from "src/chat/util";
import type { IChatMessage } from "src/chat/Chat.types";
import type { TranslationKey } from "src/react-i18next";
import CareerExplorerService from "src/careerExplorer/services/CareerExplorerService";
import { generateCareerExplorerTypingMessage } from "src/careerExplorer/components/CareerExplorerTypingMessage/CareerExplorerTypingMessage";
import { mapCareerExplorerMessagesToChatMessages } from "src/careerExplorer/utils/mapCareerExplorerMessagesToChatMessages";
import type { CareerExplorerMessage } from "src/careerExplorer/types";

export interface CareerExplorerChatProps {
  initialMessages: CareerExplorerMessage[];
  placeholderKey: TranslationKey;
  isLoading?: boolean;
}

const CareerExplorerChat: React.FC<CareerExplorerChatProps> = ({
  initialMessages,
  placeholderKey,
  isLoading = false,
}) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<IChatMessage<any>[]>(() =>
    mapCareerExplorerMessagesToChatMessages(initialMessages, theme.palette.brandAction.main)
  );
  const [aiIsTyping, setAiIsTyping] = useState(false);
  const [chatFinished, setChatFinished] = useState(false);
  const [failedSendDraft, setFailedSendDraft] = useState<string | null>(null);

  const handleSendRef = useRef<(msg: string) => void>(() => {});

  const handleQuickReply = useCallback((label: string) => {
    handleSendRef.current(label);
  }, []);

  const typingMessage = useMemo(() => generateCareerExplorerTypingMessage(), []);

  const displayMessages = useMemo(() => {
    if (aiIsTyping || (isLoading && messages.length === 0)) {
      return [...messages, typingMessage];
    }
    return messages;
  }, [messages, aiIsTyping, typingMessage, isLoading]);

  useEffect(() => {
    setMessages(
      mapCareerExplorerMessagesToChatMessages(initialMessages, theme.palette.brandAction.main, handleQuickReply)
    );
  }, [initialMessages, handleQuickReply, theme]);

  const handleSend = useCallback(
    async (userMessage: string) => {
      // Clear quick-reply buttons from all messages when user sends a new message
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.payload?.quick_reply_options) {
            return { ...msg, payload: { ...msg.payload, quick_reply_options: null } };
          }
          return msg;
        })
      );
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticUserMessage = generateUserMessage(
        userMessage,
        new Date().toISOString(),
        theme.palette.brandAction.main,
        optimisticId
      );
      setMessages((prev) => [...prev, optimisticUserMessage]);
      setAiIsTyping(true);
      setFailedSendDraft(null);
      try {
        const res = await CareerExplorerService.getInstance().sendMessage(userMessage);
        setMessages(
          mapCareerExplorerMessagesToChatMessages(res.messages, theme.palette.brandAction.main, handleQuickReply)
        );
        setChatFinished(res.finished);
      } catch (e) {
        console.error("Failed to send message", e);
        setMessages((prev) => prev.filter((msg) => msg.message_id !== optimisticId));
        setFailedSendDraft(userMessage);
      } finally {
        setAiIsTyping(false);
      }
    },
    [handleQuickReply, theme]
  );

  handleSendRef.current = handleSend;

  // Extract quick_reply_options from the last agent message (if any)
  const quickReplyOptions = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.payload?.quick_reply_options || null;
  }, [messages]);

  return (
    <ChatPage
      chatViewProps={{
        messages: displayMessages,
        quickReplyOptions,
        onQuickReplyClick: handleQuickReply,
        messageFieldProps: {
          handleSend,
          aiIsTyping,
          isChatFinished: chatFinished,
          failedSendDraft,
          placeholderKey,
          showCvUpload: false,
          fillColor: theme.palette.brandAction.main,
        },
      }}
      sidebar={<CareerExplorerSidebar />}
    />
  );
};

export default CareerExplorerChat;
