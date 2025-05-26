import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { QuestionsConfig } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.types";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { FeedbackError } from "src/error/commonErrors";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

interface FeedbackContextType {
  questionsConfig: QuestionsConfig | null;
  setQuestionsConfig: (config: QuestionsConfig) => void;
  isLoading: boolean;
  error: Error | null;
  answers: FeedbackItem[];
  handleAnswerChange: (feedback: FeedbackItem) => void;
  clearAnswers: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [questionsConfig, setQuestionsConfig] = useState<QuestionsConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [answers, setAnswers] = useState<FeedbackItem[]>(() => {
    return PersistentStorageService.getOverallFeedback();
  });

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

  const handleAnswerChange = (feedback: FeedbackItem) => {
    setAnswers((prevAnswers) => {
      const existingIndex = prevAnswers.findIndex((item) => item.question_id === feedback.question_id);

      let updatedAnswers;
      if (existingIndex !== -1) {
        updatedAnswers = [...prevAnswers];
        updatedAnswers[existingIndex] = feedback;
      } else {
        updatedAnswers = [...prevAnswers, feedback];
      }

      // Save updated answers to persistent storage
      PersistentStorageService.setOverallFeedback(updatedAnswers);

      return updatedAnswers;
    });
  };

  const clearAnswers = () => {
    PersistentStorageService.clearOverallFeedback();
    setAnswers([]);
  };

  const value = useMemo(() => ({
    questionsConfig,
    setQuestionsConfig,
    isLoading,
    error,
    answers,
    handleAnswerChange,
    clearAnswers
  }), [questionsConfig, isLoading, error, answers]);

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