import { useState } from "react";
import { Divider } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MobileStepper from "@mui/material/MobileStepper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import feedbackFormContentSteps from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/feedbackFormContentSteps";
import StepsComponent from "src/feedback/overallFeedback/feedbackForm/components/stepsComponent/StepsComponent";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import { useSwipeable } from "react-swipeable";
import { AnimatePresence, motion } from "framer-motion";

export const SLIDE_DURATION = 0.3;

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
  const [activeStep, setActiveStep] = useState(0);
  const [answers, setAnswers] = useState<FeedbackItem[]>(() => {
    return PersistentStorageService.getOverallFeedback();
  });
  // We want to know the previous step to know the direction of the swipe
  // if the previous tep is greater than the active step, the swipe is to the left
  // if the previous step is less than the active step, the swipe is to the right
  const [prevStep, setPrevStep] = useState(activeStep);

  const maxSteps = feedbackFormContentSteps.length;

  const handleNext = () => {
    if (activeStep === maxSteps - 1) {
      notifySubmit(answers);
      PersistentStorageService.clearOverallFeedback();
      setAnswers([]);
    } else {
      setPrevStep(activeStep);
      setActiveStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setPrevStep(activeStep);
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const isLastStep = activeStep === maxSteps - 1;
      if (isLastStep) return; // Do not allow to swipe forward from the last step
      handleNext();
    },
    onSwipedRight: () => {
      const isFirstStep = activeStep === 0;
      if (isFirstStep) return; // Do not allow to swipe back from the first step
      handlePrevious();
    },
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

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

  // Animation variants
  const direction = activeStep > prevStep ? 1 : -1;
  const CONTENT_GAP = 80; // content gap in px

  const variants = {
    // Animation variants for sliding content:
    // - When entering: content slides in from left/right with CONTENT_GAP spacing
    // - When centered: content is at x=0 position
    // - When exiting: content slides out in opposite direction with CONTENT_GAP spacing
    // The content gap is used to create a gap between the steps depending on the animation state
    enter: (direction: number) => ({
      x: direction > 0 ? `calc(100% + ${CONTENT_GAP}px)` : `calc(-100% - ${CONTENT_GAP}px)`,
      opacity: 1,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? `calc(100% + ${CONTENT_GAP}px)` : `calc(-100% - ${CONTENT_GAP}px)`,
      opacity: 1,
    }),
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
      height="100%"
      sx={{ overflowX: "hidden" }}
      data-testid={DATA_TEST_ID.FEEDBACK_FORM_CONTENT}
      {...swipeHandlers}
    >
      <Box
        sx={{
          position: "relative",
          overflow: "auto",
          flexGrow: 1,
          width: "100%",
        }}
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={activeStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "tween", duration: SLIDE_DURATION, ease: "easeInOut" },
              opacity: { duration: SLIDE_DURATION },
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <Typography
              fontWeight="bold"
              gutterBottom
              color={theme.palette.text.secondary}
              sx={{ fontSize: theme.typography.h6.fontSize }}
              data-testid={DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE}
            >
              {feedbackFormContentSteps[activeStep].label}
            </Typography>
            <Box
              sx={{
                overflowY: "auto",
                flexGrow: 1,
                display: "flex",
                flexDirection: "column",
                gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
              }}
              data-testid={DATA_TEST_ID.FEEDBACK_FORM_CONTENT_QUESTIONS}
            >
              <StepsComponent
                questions={feedbackFormContentSteps[activeStep].questions}
                feedbackItems={answers}
                onChange={handleAnswerChange}
              />
            </Box>
          </motion.div>
        </AnimatePresence>
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
            disableWhenOffline={activeStep === maxSteps - 1}
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
        sx={{ padding: 0 }}
      />
    </Box>
  );
};

export default FeedbackFormContent;
