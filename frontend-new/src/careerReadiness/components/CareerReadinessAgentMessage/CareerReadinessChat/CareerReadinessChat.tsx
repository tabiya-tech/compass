import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import ChatPage from "src/chat/ChatPage/ChatPage";
import CareerReadinessSidebar from "src/home/components/Sidebar/CareerReadinessSidebar";
import { generateSomethingWentWrongMessage } from "src/chat/util";
import type { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import CareerReadinessService from "src/careerReadiness/services/CareerReadinessService";
import { generateCareerReadinessTypingMessage } from "src/careerReadiness/components/CareerReadinessTypingMessage/CareerReadinessTypingMessage";
import {
  getLatestQuizHistorySummary,
  mapCareerReadinessMessagesToChatMessages,
} from "src/careerReadiness/utils/mapCareerReadinessMessagesToChatMessages";
import CareerReadinessAgentMessage, {
  CAREER_READINESS_AGENT_MESSAGE_TYPE,
  type CareerReadinessAgentMessageProps,
} from "src/careerReadiness/components/CareerReadinessAgentMessage/CareerReadinessAgentMessage";
import CareerReadinessQuizChatMessage, {
  CAREER_READINESS_QUIZ_CHAT_MESSAGE_TYPE,
  type CareerReadinessQuizChatMessageProps,
  type QuizSubmissionResult,
} from "src/careerReadiness/components/CareerReadinessQuizChatMessage/CareerReadinessQuizChatMessage";
import CareerReadinessUserMessage, {
  CAREER_READINESS_USER_MESSAGE_TYPE,
  type CareerReadinessUserMessageProps,
} from "src/careerReadiness/components/CareerReadinessUserMessage/CareerReadinessUserMessage";
import type { QuizSubmissionResponse } from "src/careerReadiness/types";

export interface CareerReadinessChatProps {
  moduleId: string;
  moduleTitle: string;
  initialConversationId: string | null;
  inputPlaceholder: string;
  onModuleCompleted?: () => void;
}

const CareerReadinessChat: React.FC<CareerReadinessChatProps> = ({
  moduleId,
  moduleTitle,
  initialConversationId,
  inputPlaceholder,
  onModuleCompleted,
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<IChatMessage<any>[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [isLoadingHistory, setIsLoadingHistory] = useState(Boolean(initialConversationId));
  const [aiIsTyping, setAiIsTyping] = useState(false);
  const [isChatLockedForQuiz, setIsChatLockedForQuiz] = useState(false);
  const [failedSendDraft, setFailedSendDraft] = useState<string | null>(null);
  const [sidebarRefreshToken, setSidebarRefreshToken] = useState(0);

  const handleSendRef = useRef<(msg: string) => void>(() => {});

  const handleQuickReply = useCallback((label: string) => {
    handleSendRef.current(label);
  }, []);

  const typingMessage = useMemo(() => generateCareerReadinessTypingMessage(), []);

  const displayMessages = useMemo(() => {
    if (aiIsTyping) {
      return [...messages, typingMessage];
    }
    return messages;
  }, [messages, aiIsTyping, typingMessage]);

  const showTyping = isLoadingHistory || !conversationId ? [typingMessage] : displayMessages;

  const buildCorrectAnswersSummary = useCallback(
    (answers: Record<number, string>, questionResults: { question_index: number; is_correct: boolean }[]) => {
      const correctAnswers = questionResults
        .filter((result) => result.is_correct)
        .map((result) => `${result.question_index}.${answers[result.question_index]}`)
        .filter(Boolean);

      return correctAnswers.length > 0
        ? t("careerReadiness.quizCorrectAnswersSummary", { answers: correctAnswers.join(", ") })
        : undefined;
    },
    [t]
  );

  const buildResultAgentMessage = useCallback(
    (
      targetConversationId: string,
      message: string,
      options?: { messageId?: string; sentAt?: string }
    ): IChatMessage<CareerReadinessAgentMessageProps> => {
      const messageId = options?.messageId ?? `quiz-result-${targetConversationId}-${Date.now()}`;
      const sentAt = options?.sentAt ?? new Date().toISOString();
      return {
        type: CAREER_READINESS_AGENT_MESSAGE_TYPE,
        message_id: messageId,
        sender: ConversationMessageSender.COMPASS,
        payload: {
          message_id: messageId,
          message,
          sent_at: sentAt,
        },
        component: (p: CareerReadinessAgentMessageProps) => <CareerReadinessAgentMessage {...p} />,
      };
    },
    []
  );

  const buildPassedQuizMessage = useCallback(
    (score: number, total: number): string => {
      return t("careerReadiness.quizPassedAgentMessage", { score, total });
    },
    [t]
  );

  const buildUserMessage = useCallback(
    (message: string, messageId?: string): IChatMessage<CareerReadinessUserMessageProps> => {
      return {
        type: CAREER_READINESS_USER_MESSAGE_TYPE,
        message_id: messageId ?? `career-readiness-user-${Date.now()}`,
        sender: ConversationMessageSender.USER,
        payload: {
          message,
          fillColor: theme.palette.secondary.main,
        },
        component: (p: CareerReadinessUserMessageProps) => <CareerReadinessUserMessage {...p} />,
      };
    },
    [theme]
  );

  const serializeAnswers = useCallback((answers: Record<number, string>): Record<string, string> => {
    const serialized: Record<string, string> = {};
    Object.entries(answers).forEach(([k, v]) => {
      serialized[String(k)] = v;
    });
    return serialized;
  }, []);

  const persistQuizQuestions = useCallback(
    (targetConversationId: string, questions: CareerReadinessQuizChatMessageProps["questions"]) => {
      const existing = PersistentStorageService.getCareerReadinessQuizData(moduleId, targetConversationId) ?? {};
      PersistentStorageService.setCareerReadinessQuizData(moduleId, targetConversationId, {
        ...existing,
        questions,
      });
    },
    [moduleId]
  );

  const buildQuizSubmissionResult = useCallback(
    (answers: Record<number, string>, submission: QuizSubmissionResponse): QuizSubmissionResult => {
      return {
        score: submission.score,
        total: submission.total,
        passed: submission.passed,
        submittedAt: Date.now(),
        correctAnswersSummary: buildCorrectAnswersSummary(answers, submission.question_results),
      };
    },
    [buildCorrectAnswersSummary]
  );

  const persistQuizResult = useCallback(
    (targetConversationId: string, submissionResult: QuizSubmissionResult) => {
      PersistentStorageService.setCareerReadinessQuizResult(moduleId, targetConversationId, {
        score: submissionResult.score,
        total: submissionResult.total,
        passed: submissionResult.passed,
        submitted_at: submissionResult.submittedAt,
        correct_answers_summary: submissionResult.correctAnswersSummary,
      });
    },
    [moduleId]
  );

  const appendOrReplaceQuizMessage = useCallback(
    (
      prev: IChatMessage<any>[],
      targetConversationId: string,
      questions: CareerReadinessQuizChatMessageProps["questions"],
      onSubmit: CareerReadinessQuizChatMessageProps["onSubmit"],
      extraPayload: Partial<CareerReadinessQuizChatMessageProps> = {}
    ) => {
      const quizMessage: IChatMessage<CareerReadinessQuizChatMessageProps> = {
        type: CAREER_READINESS_QUIZ_CHAT_MESSAGE_TYPE,
        message_id: `quiz-${targetConversationId}`,
        sender: ConversationMessageSender.COMPASS,
        payload: {
          message_id: `quiz-${targetConversationId}`,
          questions,
          onSubmit,
          moduleId,
          conversationId: targetConversationId,
          ...extraPayload,
        },
        component: (p: CareerReadinessQuizChatMessageProps) => <CareerReadinessQuizChatMessage {...p} />,
      };

      const quizIndex = prev.findIndex((m) => m.type === CAREER_READINESS_QUIZ_CHAT_MESSAGE_TYPE);
      if (quizIndex === -1) {
        return [...prev, quizMessage];
      }
      return [...prev.slice(0, quizIndex), quizMessage, ...prev.slice(quizIndex + 1)];
    },
    [moduleId]
  );

  const createQuizSubmitHandler = useCallback(
    (
      targetConversationId: string,
      questions: CareerReadinessQuizChatMessageProps["questions"]
    ): CareerReadinessQuizChatMessageProps["onSubmit"] => {
      const handleQuizSubmit: CareerReadinessQuizChatMessageProps["onSubmit"] = async (answers) => {
        const submission = await CareerReadinessService.getInstance().submitQuiz(
          moduleId,
          targetConversationId,
          serializeAnswers(answers)
        );
        const submissionResult = buildQuizSubmissionResult(answers, submission);

        if (submission.passed) {
          enqueueSnackbar(t("careerReadiness.quizPassedNotification"), { variant: "success" });
          setIsChatLockedForQuiz(false);
          setSidebarRefreshToken((t) => t + 1);
        } else {
          enqueueSnackbar(t("careerReadiness.quizFailedNotification"), { variant: "error" });
          setIsChatLockedForQuiz(true);
        }

        setMessages((prev) => {
          const updatedMessages = appendOrReplaceQuizMessage(prev, targetConversationId, questions, handleQuizSubmit, {
            submissionResult,
            lastAnswers: answers,
          });

          return submission.passed
            ? [
                ...updatedMessages,
                buildResultAgentMessage(
                  targetConversationId,
                  buildPassedQuizMessage(submission.score, submission.total)
                ),
              ]
            : updatedMessages;
        });

        persistQuizResult(targetConversationId, submissionResult);

        if (submission.passed && submission.module_completed) {
          onModuleCompleted?.();
        }
      };

      return handleQuizSubmit;
    },
    [
      moduleId,
      serializeAnswers,
      buildQuizSubmissionResult,
      enqueueSnackbar,
      t,
      appendOrReplaceQuizMessage,
      buildResultAgentMessage,
      buildPassedQuizMessage,
      persistQuizResult,
      onModuleCompleted,
    ]
  );

  const loadHistory = useCallback(
    async (conversationIdOverride?: string | null, getIsCancelled?: () => boolean) => {
      const id = conversationIdOverride ?? conversationId;
      if (!id) return;
      setIsLoadingHistory(true);
      try {
        const res = await CareerReadinessService.getInstance().getConversationHistory(moduleId, id);
        if (getIsCancelled?.()) return;
        let chatMessages = mapCareerReadinessMessagesToChatMessages(
          res.messages,
          theme.palette.secondary.main,
          handleQuickReply
        );
        const latestQuizSummary = getLatestQuizHistorySummary(res.messages);

        const storedQuizData = PersistentStorageService.getCareerReadinessQuizData(moduleId, id);
        const storedQuestions = storedQuizData?.questions;
        const storedResult = PersistentStorageService.getCareerReadinessQuizResult(moduleId, id);
        const shouldShowQuiz = res.quiz_available || (Boolean(latestQuizSummary) && Boolean(storedQuestions?.length));
        const hasPassedQuiz = latestQuizSummary?.passed ?? storedResult?.passed ?? false;
        setIsChatLockedForQuiz(shouldShowQuiz && !hasPassedQuiz);

        if (shouldShowQuiz) {
          try {
            const questions = res.quiz_available
              ? (await CareerReadinessService.getInstance().getQuiz(moduleId, id)).questions
              : storedQuestions ?? [];
            if (res.quiz_available) {
              persistQuizQuestions(id, questions);
            }
            if (getIsCancelled?.()) return;
            const handleQuizSubmit = createQuizSubmitHandler(id, questions);

            chatMessages = appendOrReplaceQuizMessage(chatMessages, id, questions, handleQuizSubmit, {
              submissionResult:
                latestQuizSummary || storedResult
                  ? {
                      score: latestQuizSummary?.score ?? storedResult?.score ?? 0,
                      total: latestQuizSummary?.total ?? storedResult?.total ?? 0,
                      passed: latestQuizSummary?.passed ?? storedResult?.passed ?? false,
                      submittedAt: storedResult?.submitted_at ?? Date.now(),
                      correctAnswersSummary: storedResult?.correct_answers_summary,
                    }
                  : undefined,
              lastAnswers: latestQuizSummary?.answers ?? storedQuizData?.answers ?? undefined,
            });

            if (latestQuizSummary?.passed) {
              chatMessages = [
                ...chatMessages,
                buildResultAgentMessage(
                  id,
                  latestQuizSummary.feedbackMessage ??
                    buildPassedQuizMessage(
                      latestQuizSummary.score ?? storedResult?.score ?? 0,
                      latestQuizSummary.total ?? storedResult?.total ?? 0
                    ),
                  {
                    messageId: latestQuizSummary.feedbackMessageId,
                    sentAt: latestQuizSummary.feedbackSentAt,
                  }
                ),
              ];
            }
          } catch (quizErr) {
            console.error("Failed to load quiz", quizErr);
          }
        }

        setMessages(chatMessages);
        const completed = res.module_completed;
        if (completed) onModuleCompleted?.();
      } catch (e) {
        console.error("Failed to load conversation history", e);
        if (getIsCancelled?.()) return;
        setMessages([generateSomethingWentWrongMessage()]);
      } finally {
        if (!getIsCancelled?.()) {
          setIsLoadingHistory(false);
        }
      }
    },
    [
      theme,
      moduleId,
      conversationId,
      onModuleCompleted,
      appendOrReplaceQuizMessage,
      buildPassedQuizMessage,
      buildResultAgentMessage,
      createQuizSubmitHandler,
      persistQuizQuestions,
      handleQuickReply,
    ]
  );

  const loadHistoryRef = useRef(loadHistory);
  loadHistoryRef.current = loadHistory;

  useEffect(() => {
    if (initialConversationId) {
      setConversationId(initialConversationId);
      let cancelled = false;
      loadHistoryRef
        .current(initialConversationId, () => cancelled)
        .catch(() => {
          // Error already logged and state handled in loadHistory
        });
      return () => {
        cancelled = true;
      };
    }
    setConversationId(null);
    setMessages([]);
    setIsLoadingHistory(false);
    setIsChatLockedForQuiz(false);
  }, [initialConversationId]);

  const handleSend = useCallback(
    async (userMessage: string) => {
      if (!conversationId) return;
      if (isChatLockedForQuiz) return;
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
      const optimisticUserMessage = buildUserMessage(userMessage, optimisticId);
      setMessages((prev) => [...prev, optimisticUserMessage]);
      setAiIsTyping(true);
      setFailedSendDraft(null);
      try {
        const res = await CareerReadinessService.getInstance().sendMessage(moduleId, conversationId, userMessage);
        let chatMessages = mapCareerReadinessMessagesToChatMessages(
          res.messages,
          theme.palette.secondary.main,
          handleQuickReply
        );

        if (res.quiz_available) {
          try {
            const quizRes = await CareerReadinessService.getInstance().getQuiz(moduleId, conversationId);
            persistQuizQuestions(conversationId, quizRes.questions);
            const handleQuizSubmit = createQuizSubmitHandler(conversationId, quizRes.questions);

            chatMessages = appendOrReplaceQuizMessage(
              chatMessages,
              conversationId,
              quizRes.questions,
              handleQuizSubmit
            );
          } catch (quizErr) {
            console.error("Failed to load quiz", quizErr);
          }
        }

        setMessages(chatMessages);
        setSidebarRefreshToken((t) => t + 1);
        const completed = res.module_completed;
        if (completed) onModuleCompleted?.();
      } catch (e) {
        console.error("Failed to send message", e);
        setMessages((prev) => prev.filter((msg) => msg.message_id !== optimisticId));
        setFailedSendDraft(userMessage);
      } finally {
        setAiIsTyping(false);
      }
    },
    [
      moduleId,
      conversationId,
      isChatLockedForQuiz,
      onModuleCompleted,
      appendOrReplaceQuizMessage,
      buildUserMessage,
      persistQuizQuestions,
      createQuizSubmitHandler,
      handleQuickReply,
      theme,
    ]
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
        messages: showTyping,
        quickReplyOptions,
        onQuickReplyClick: handleQuickReply,
        messageFieldProps: {
          handleSend,
          aiIsTyping: aiIsTyping || isLoadingHistory || !conversationId,
          isInputDisabled: isChatLockedForQuiz,
          isChatFinished: false,
          isUploadingCv: false,
          failedSendDraft,
          customPlaceholder: isChatLockedForQuiz ? t("careerReadiness.chatLockedUntilQuizPassed") : inputPlaceholder,
          fillColor: theme.palette.secondary.main,
        },
      }}
      sidebar={<CareerReadinessSidebar refreshToken={sidebarRefreshToken} />}
    />
  );
};

export default CareerReadinessChat;
