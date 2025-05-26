import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { QuestionsConfig } from "../feedbackForm/feedbackForm.types";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { FeedbackError } from "src/error/commonErrors";

interface FeedbackContextType {
  questionsConfig: QuestionsConfig | null;
  setQuestionsConfig: (config: QuestionsConfig) => void;
  isLoading: boolean;
  error: Error | null;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [questionsConfig, setQuestionsConfig] = useState<QuestionsConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchQuestionsConfig = async () => {
      try {
        setIsLoading(true);

        const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId()
        if (!activeSessionId) {
          throw new FeedbackError('No active session found');
        }
        const service = OverallFeedbackService.getInstance();
        const config = await service.getQuestionsConfig(activeSessionId);
        setQuestionsConfig(config);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch questions configuration'));
        console.error('Error fetching questions configuration:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestionsConfig();
  }, []);

  const value = useMemo(() => ({
    questionsConfig,
    setQuestionsConfig,
    isLoading,
    error
  }), [questionsConfig, isLoading, error]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (context === undefined) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }
  return context;
}; 