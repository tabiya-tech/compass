import React, { useEffect, useState } from "react";
import { Box, Divider, styled, Typography, useTheme } from "@mui/material";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import CareerReadinessQuiz from "src/careerReadiness/components/CareerReadinessQuiz/CareerReadinessQuiz";
import BrandLogo from "src/chat/chatMessage/components/brandLogo/BrandLogo";
import type { QuizQuestionResponse, QuizQuestionResult } from "src/careerReadiness/types";

const uniqueId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export const DATA_TEST_ID = {
  CAREER_READINESS_QUIZ_CHAT_MESSAGE_CONTAINER: `career-readiness-quiz-chat-message-container-${uniqueId}`,
  CAREER_READINESS_QUIZ_CHAT_MESSAGE_BRAND_LOGO: `career-readiness-quiz-chat-message-brand-logo-${uniqueId}`,
};

export const CAREER_READINESS_QUIZ_CHAT_MESSAGE_TYPE = `career-readiness-quiz-chat-message-${uniqueId}`;

export interface QuizSubmissionResult {
  score: number;
  total: number;
  passed: boolean;
  submittedAt: number;
  correctAnswersSummary?: string;
  questionResults?: QuizQuestionResult[];
}

export interface CareerReadinessQuizChatMessageProps {
  message_id: string;
  introMessage?: string;
  questions: QuizQuestionResponse[];
  onSubmit: (answers: Record<number, string>) => Promise<void>;
  moduleId?: string;
  conversationId?: string;
  submissionResult?: QuizSubmissionResult;
  lastAnswers?: Record<number, string>;
}

const MessageContainer = styled(Box)<{ origin: ConversationMessageSender }>(({ theme, origin }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: origin === ConversationMessageSender.USER ? "flex-end" : "flex-start",
  marginBottom: theme.spacing(theme.tabiyaSpacing.sm),
  width: "100%",
}));

const AgentBubble = styled(Box)(({ theme }) => ({
  width: "100%",
  minWidth: "100%",
  maxWidth: "100%",
  padding: theme.fixedSpacing(theme.tabiyaSpacing.sm),
  borderRadius: "12px 12px 12px 0px",
  backgroundColor: theme.palette.grey[100],
  color: theme.palette.text.primary,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
}));

const CareerReadinessQuizChatMessage: React.FC<CareerReadinessQuizChatMessageProps> = ({
  message_id,
  introMessage,
  questions,
  onSubmit,
  moduleId,
  conversationId,
  submissionResult,
  lastAnswers,
}) => {
  const theme = useTheme();
  const [hideResultForRetry, setHideResultForRetry] = useState(false);

  useEffect(() => {
    setHideResultForRetry(false);
  }, [submissionResult?.submittedAt]);

  if (!questions.length) {
    return null;
  }

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={`${DATA_TEST_ID.CAREER_READINESS_QUIZ_CHAT_MESSAGE_CONTAINER}-${message_id}`}
    >
      <Box data-testid={DATA_TEST_ID.CAREER_READINESS_QUIZ_CHAT_MESSAGE_BRAND_LOGO}>
        <BrandLogo />
      </Box>
      <AgentBubble>
        {introMessage && (
          <>
            <Typography variant="body1" whiteSpace="pre-line" sx={{ mb: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}>
              {introMessage}
            </Typography>
            <Divider sx={{ alignSelf: "stretch", mb: theme.fixedSpacing(theme.tabiyaSpacing.sm) }} />
          </>
        )}

        <Box sx={{ width: "100%" }}>
          <CareerReadinessQuiz
            questions={questions}
            onComplete={onSubmit}
            initialAnswers={lastAnswers}
            lastAnswers={lastAnswers}
            moduleId={moduleId}
            conversationId={conversationId}
            submissionResult={submissionResult && !hideResultForRetry ? submissionResult : undefined}
            onRetry={() => {
              if (moduleId && conversationId) {
                PersistentStorageService.clearCareerReadinessQuizResult(moduleId, conversationId);
              }
              setHideResultForRetry(true);
            }}
          />
        </Box>
      </AgentBubble>
    </MessageContainer>
  );
};

export default CareerReadinessQuizChatMessage;
