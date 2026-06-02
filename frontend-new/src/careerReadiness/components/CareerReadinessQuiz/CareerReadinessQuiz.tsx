import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  Collapse,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Typography,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useTranslation } from "react-i18next";
import ArrowBackIosNewOutlined from "@mui/icons-material/ArrowBackIosNewOutlined";
import ArrowForwardIosOutlined from "@mui/icons-material/ArrowForwardIosOutlined";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import type { QuizQuestionResponse, QuizQuestionResult } from "src/careerReadiness/types";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

const uniqueId = "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e";

const OPTION_PATTERN = /^([A-D])\.\s*(.+)$/;

/** Parse backend option "A. Text" into { key: "A", text: "Text" }. */
const parseOption = (option: string): { key: string; text: string } => {
  const match = OPTION_PATTERN.exec(option.trim());
  if (match) {
    return { key: match[1].toUpperCase(), text: match[2].trim() || option };
  }
  return { key: option.charAt(0).toUpperCase(), text: option };
};

export const DATA_TEST_ID = {
  QUIZ_CONTAINER: `career-readiness-quiz-container-${uniqueId}`,
  QUIZ_QUESTION: `career-readiness-quiz-question-${uniqueId}`,
  QUIZ_OPTION: `career-readiness-quiz-option-${uniqueId}`,
  QUIZ_SUBMIT: `career-readiness-quiz-submit-${uniqueId}`,
  QUIZ_PROGRESS: `career-readiness-quiz-progress-${uniqueId}`,
  QUIZ_NEXT: `career-readiness-quiz-next-${uniqueId}`,
  QUIZ_PREV: `career-readiness-quiz-prev-${uniqueId}`,
};

export interface CareerReadinessQuizProps {
  questions: QuizQuestionResponse[];
  onComplete: (answers: Record<number, string>) => void | Promise<void>;
  initialAnswers?: Record<number, string>;
  lastAnswers?: Record<number, string>;
  moduleId?: string;
  conversationId?: string;
  submissionResult?: {
    score?: number;
    total?: number;
    passed: boolean;
    correctAnswersSummary?: string;
    questionResults?: QuizQuestionResult[];
  };
  onRetry?: () => void;
}

const CareerReadinessQuiz: React.FC<CareerReadinessQuizProps> = ({
  questions,
  onComplete,
  initialAnswers,
  lastAnswers,
  moduleId,
  conversationId,
  submissionResult,
  onRetry,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isPassed = Boolean(submissionResult?.passed);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    if (initialAnswers && Object.keys(initialAnswers).length > 0) return initialAnswers;
    if (moduleId && conversationId) {
      const stored = PersistentStorageService.getCareerReadinessQuizData(moduleId, conversationId)?.answers;
      if (stored) return stored;
    }
    return {};
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    if (initialAnswers && Object.keys(initialAnswers).length > 0) {
      setAnswers(initialAnswers);
    }
  }, [initialAnswers]);

  const total = questions.length;
  const question = questions[currentStep];
  const isLastStep = currentStep === total - 1;
  const isFirstStep = currentStep === 0;
  const questionNumber = currentStep + 1;
  const currentAnswer = answers[questionNumber];

  const parsedOptions = useMemo(() => (question ? question.options.map(parseOption) : []), [question]);

  const setAnswer = useCallback(
    (qNumber: number, value: string) => {
      setAnswers((prev) => {
        const next = { ...prev, [qNumber]: value };
        if (moduleId && conversationId) {
          const existing = PersistentStorageService.getCareerReadinessQuizData(moduleId, conversationId) ?? {};
          PersistentStorageService.setCareerReadinessQuizData(moduleId, conversationId, {
            ...existing,
            answers: next,
          });
        }
        return next;
      });
    },
    [moduleId, conversationId]
  );

  const canGoNext = Boolean(currentAnswer?.length);

  const handleNext = useCallback(() => {
    if (isLastStep) return;
    setCurrentStep((s) => Math.min(s + 1, total - 1));
  }, [isLastStep, total]);

  const handlePrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onComplete(answers);
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, onComplete]);

  if (total === 0) return null;

  return (
    <Card
      sx={{
        borderRadius: theme.rounding(theme.tabiyaRounding.sm),
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: "none",
        overflow: "hidden",
        minHeight: 280,
        display: "flex",
        flexDirection: "column",
      }}
      data-testid={DATA_TEST_ID.QUIZ_CONTAINER}
    >
      <LinearProgress
        aria-label="Career Readiness Quiz Progress"
        variant="determinate"
        value={total > 0 ? ((currentStep + 1) / total) * 100 : 0}
        sx={{
          height: 4,
          flexShrink: 0,
          "& .MuiLinearProgress-bar": { borderRadius: 0 },
        }}
        data-testid={DATA_TEST_ID.QUIZ_PROGRESS}
      />

      <Box
        sx={{
          padding: theme.fixedSpacing(theme.tabiyaSpacing.md),
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }} data-testid={DATA_TEST_ID.QUIZ_PROGRESS}>
          {t("careerReadiness.quizQuestionOf", { current: currentStep + 1, total })}
        </Typography>

        <Box
          sx={{ flex: 1, minHeight: 0, overflow: "auto" }}
          data-testid={`${DATA_TEST_ID.QUIZ_QUESTION}-${questionNumber}`}
        >
          <Typography variant="body1" fontWeight="bold" sx={{ mb: 1.5 }}>
            {question.question}
          </Typography>

          <RadioGroup value={currentAnswer ?? ""} onChange={(_, value) => setAnswer(questionNumber, value)}>
            {parsedOptions.map((opt) => (
              <FormControlLabel
                key={opt.key}
                value={opt.key}
                control={<Radio size="small" />}
                label={<Typography variant="body2">{`${opt.key}. ${opt.text}`}</Typography>}
                data-testid={`${DATA_TEST_ID.QUIZ_OPTION}-${questionNumber}-${opt.key}`}
                sx={{ mx: 0, mb: 0.5 }}
                disabled={isPassed}
              />
            ))}
          </RadioGroup>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mt: theme.fixedSpacing(theme.tabiyaSpacing.md),
            pt: theme.fixedSpacing(theme.tabiyaSpacing.sm),
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <PrimaryButton
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<ArrowBackIosNewOutlined />}
            onClick={handlePrev}
            disabled={isFirstStep}
            aria-label={t("careerReadiness.quizPrevious")}
            data-testid={DATA_TEST_ID.QUIZ_PREV}
          >
            {t("careerReadiness.quizPrevious")}
          </PrimaryButton>

          {isLastStep ? (
            <PrimaryButton
              variant="contained"
              color="secondary"
              disabled={!canGoNext || isSubmitting || isPassed}
              onClick={handleSubmit}
              data-testid={DATA_TEST_ID.QUIZ_SUBMIT}
            >
              {isSubmitting ? t("common.buttons.submit") + "…" : t("common.buttons.submit")}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              variant="contained"
              color="secondary"
              disabled={!canGoNext}
              onClick={handleNext}
              endIcon={<ArrowForwardIosOutlined />}
              data-testid={DATA_TEST_ID.QUIZ_NEXT}
            >
              {t("careerReadiness.quizNext")}
            </PrimaryButton>
          )}
        </Box>

        {submissionResult && (
          <Box
            sx={{
              mt: theme.fixedSpacing(theme.tabiyaSpacing.sm),
              pt: theme.fixedSpacing(theme.tabiyaSpacing.sm),
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          >
            {submissionResult.passed ? (
              <Typography variant="body2">{t("careerReadiness.quizPassedInline")}</Typography>
            ) : (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                    flexWrap: "wrap",
                    mb: submissionResult.questionResults?.some((r) => !r.is_correct) ? 2 : 0,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    sx={{
                      color: theme.palette.error.dark,
                    }}
                  >
                    {t("careerReadiness.quizFailedInline")}
                  </Typography>
                  {onRetry && (
                    <PrimaryButton
                      variant="outlined"
                      size="small"
                      onClick={onRetry}
                      sx={{
                        color: theme.palette.error.dark,
                        borderColor: theme.palette.error.dark,
                        "&:hover": {
                          backgroundColor: theme.palette.error.light,
                        },
                      }}
                    >
                      {t("careerReadiness.quizRetry")}
                    </PrimaryButton>
                  )}
                </Box>

                {submissionResult.questionResults?.some((r) => !r.is_correct) && (
                  <Box>
                    <PrimaryButton
                      variant="text"
                      size="small"
                      onClick={() => setShowAnswers((prev) => !prev)}
                      endIcon={showAnswers ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      sx={{ mb: 1, px: 0 }}
                    >
                      {showAnswers ? t("careerReadiness.quizHideAnswers") : t("careerReadiness.quizShowAnswers")}
                    </PrimaryButton>
                    <Collapse in={showAnswers}>
                      <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                        {t("careerReadiness.quizWrongAnswersTitle")}
                      </Typography>
                      {submissionResult.questionResults
                        .filter((r) => !r.is_correct)
                        .map((r) => {
                          const q = questions[r.question_index - 1];
                          if (!q) return null;
                          const userAnswer = lastAnswers?.[r.question_index];
                          return (
                            <Box key={r.question_index} sx={{ mb: 2 }}>
                              <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
                                {q.question}
                              </Typography>
                              {q.options.map((opt) => {
                                const { key } = parseOption(opt);
                                const isCorrect = key === r.correct_answer;
                                const isWrong = key === userAnswer && !isCorrect;
                                return (
                                  <Box
                                    key={key}
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                      px: 1,
                                      py: 0.5,
                                      my: 0.25,
                                      borderRadius: 1,
                                      bgcolor: isCorrect
                                        ? theme.palette.success.light
                                        : isWrong
                                          ? theme.palette.error.light
                                          : "transparent",
                                    }}
                                  >
                                    <Typography variant="body2" sx={{ flex: 1 }}>
                                      {opt}
                                    </Typography>
                                    {isCorrect && (
                                      <Typography variant="caption" color="success.dark" sx={{ whiteSpace: "nowrap" }}>
                                        {t("careerReadiness.quizCorrectAnswer")}
                                      </Typography>
                                    )}
                                    {isWrong && (
                                      <Typography variant="caption" color="error.dark" sx={{ whiteSpace: "nowrap" }}>
                                        {t("careerReadiness.quizYourAnswer")}
                                      </Typography>
                                    )}
                                  </Box>
                                );
                              })}
                            </Box>
                          );
                        })}
                    </Collapse>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default CareerReadinessQuiz;
