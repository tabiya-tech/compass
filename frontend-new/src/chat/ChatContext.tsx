import { createContext, useContext, ReactNode, useState, useMemo } from 'react';
import { FeedbackStatus } from 'src/feedback/overallFeedback/feedbackForm/FeedbackForm';
import { PersistentStorageService } from 'src/app/PersistentStorageService/PersistentStorageService';

interface ChatContextType {
  handleOpenExperiencesDrawer: () => void;
  feedbackStatus: FeedbackStatus;
  setFeedbackStatus: (status: FeedbackStatus) => void;
  isAccountConverted: boolean;
  setIsAccountConverted: (converted: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: ReactNode;
  handleOpenExperiencesDrawer: () => void;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children, handleOpenExperiencesDrawer }) => {
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>(FeedbackStatus.NOT_STARTED);
  const [isAccountConverted, setIsAccountConverted] = useState<boolean>(PersistentStorageService.getAccountConverted());

  const value = useMemo(() => ({
    handleOpenExperiencesDrawer,
    feedbackStatus,
    setFeedbackStatus,
    isAccountConverted,
    setIsAccountConverted: (converted: boolean) => {
      PersistentStorageService.setAccountConverted(converted);
      setIsAccountConverted(converted);
    },
  }), [feedbackStatus, handleOpenExperiencesDrawer, isAccountConverted]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}; 