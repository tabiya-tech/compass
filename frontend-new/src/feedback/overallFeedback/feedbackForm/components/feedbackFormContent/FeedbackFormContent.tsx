import * as React from "react";
import { useState } from "react";
import { Divider, useMediaQuery } from "@mui/material";
import { Theme, useTheme } from "@mui/material/styles";
import MobileStepper from "@mui/material/MobileStepper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import feedbackFormContentSteps from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/feedbackFormContentSteps";
import StepsComponent from "src/feedback/overallFeedback/feedbackForm/components/stepsComponent/StepsComponent";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";

interface FeedbackFormContentProps {
  notifySubmit: (formData: FeedbackItem[]) => void;
}

const uniqueId = "07d1ed9d-6ced-4a24-912a-9b89199df67f";

export const DATA_TEST_ID = {
  FEEDBACK_FORM_CONTENT: `feedback-form-content-${uniqueId}`,
  FEEDBACK_FORM_CONTENT_TITLE: `feedback-form-content-title-${uniqueId}`,
  FEEDBACK_FORM_CONTENT_QUESTIONS: `feedback-form-content-questions-${uniqueId}`,
  FEEDBACK_FORM_CONTENT_DIVIDER: `feedback-form-content-divider-${uniqueId}`,
  FEEDBACK_FORM_NEXT_BUTTON: `feedback-form-next-button-${uniqueId}`,
  FEEDBACK_FORM_BACK_BUTTON: `feedback-form-back-button-${uniqueId}`,
};

const FeedbackFormContent: React.FC<FeedbackFormContentProps> = ({ notifySubmit }) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [activeStep, setActiveStep] = React.useState(0);
  const [answers, setAnswers] = useState<FeedbackItem[]>(() => {
    return PersistentStorageService.getOverallFeedback();
  });

  const maxSteps = feedbackFormContentSteps.length;

  const handleNext = () => {
    if (activeStep === maxSteps - 1) {
      notifySubmit(answers);
      PersistentStorageService.clearOverallFeedback();
      setAnswers([]);
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

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

  // Check if there is at least one answer
  const hasAnswers = Object.keys(answers).length > 0;

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={isSmallMobile ? 6 : 3}
      height="100%"
      data-testid={DATA_TEST_ID.FEEDBACK_FORM_CONTENT}
    >
      <Typography
        fontWeight="bold"
        color={theme.palette.text.secondary}
        sx={{ fontSize: theme.typography.h6.fontSize }}
        data-testid={DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE}
      >
        {feedbackFormContentSteps[activeStep].label}
      </Typography>
      <Box
        sx={{
          overflowY: "auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: isSmallMobile ? theme.spacing(6) : theme.spacing(3),
        }}
        data-testid={DATA_TEST_ID.FEEDBACK_FORM_CONTENT_QUESTIONS}
      >
        <StepsComponent
          questions={feedbackFormContentSteps[activeStep].questions}
          feedbackItems={answers}
          onChange={handleAnswerChange}
        />
      </Box>
      <Divider color="primary" sx={{ height: "0.2rem" }} data-testid={DATA_TEST_ID.FEEDBACK_FORM_CONTENT_DIVIDER} />
      <MobileStepper
        variant="dots"
        steps={maxSteps}
        position="static"
        activeStep={activeStep}
        nextButton={
          <PrimaryButton
            onClick={handleNext}
            disabled={activeStep === maxSteps - 1 && !hasAnswers}
            style={{ width: 100 }}
            data-testid={DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON}
          >
            {activeStep === maxSteps - 1 ? "Submit" : "Next"}
          </PrimaryButton>
        }
        backButton={
          <SecondaryButton
            onClick={handlePrevious}
            disabled={activeStep === 0}
            data-testid={DATA_TEST_ID.FEEDBACK_FORM_BACK_BUTTON}
          >
            Previous
          </SecondaryButton>
        }
        sx={{ height: "50px", paddingX: 0 }}
      />
    </Box>
  );
};

export default FeedbackFormContent;
