import React, { createContext, useContext, ReactNode, useState, useMemo } from 'react';
import { FeedbackStatus } from 'src/feedback/overallFeedback/overallFeedbackForm/OverallFeedbackForm';
import { PersistentStorageService } from 'src/app/PersistentStorageService/PersistentStorageService';
import { IChatMessage } from "src/chat/Chat.types";

interface ChatContextType {
  handleOpenExperiencesDrawer: () => void;
  removeMessage: (messageId: string) => void;
  addMessage: (message: IChatMessage<any>) => void;
  feedbackStatus: FeedbackStatus;
  setFeedbackStatus: (status: FeedbackStatus) => void;
  isAccountConverted: boolean;
  setIsAccountConverted: (converted: boolean) => void;
}

export const ChatContext = createContext<ChatContextType | null>(null);

interface ChatProviderProps {
  children: ReactNode;
  handleOpenExperiencesDrawer: () => void;
  removeMessage: (messageId: string) => void;
  addMessage: (message: IChatMessage<any>) => void;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children, handleOpenExperiencesDrawer, removeMessage, addMessage }) => {
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>(FeedbackStatus.NOT_STARTED);
  const [isAccountConverted, setIsAccountConverted] = useState<boolean>(PersistentStorageService.getAccountConverted());

  const value = useMemo(() => ({
    handleOpenExperiencesDrawer,
    removeMessage,
    addMessage,
    feedbackStatus, //TODO: move to feedback context
    setFeedbackStatus,
    isAccountConverted,
    setIsAccountConverted: (converted: boolean) => {
      PersistentStorageService.setAccountConverted(converted);
      setIsAccountConverted(converted);
    },
  }), [feedbackStatus, handleOpenExperiencesDrawer, isAccountConverted, removeMessage, addMessage]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}; 