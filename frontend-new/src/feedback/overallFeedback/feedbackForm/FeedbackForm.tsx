import React from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle, Typography, useTheme } from "@mui/material";
import FeedbackFormContent from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import CloseIcon from "@mui/icons-material/Close";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { FeedbackError } from "src/error/commonErrors";
import { useIsSmallOrShortScreen } from "src/feedback/overallFeedback/feedbackForm/useIsSmallOrShortScreen";

export interface FeedbackFormProps {
  isOpen: boolean;
  notifyOnClose: (event: FeedbackCloseEvent) => void;
}

export enum FeedbackStatus {
  STARTED = "STARTED",
  NOT_STARTED = "NOT_STARTED",
  SUBMITTED = "SUBMITTED",
}

export enum FeedbackCloseEvent {
  DISMISS = "DISMISS",
  SUBMIT = "SUBMIT",
}

const uniqueId = "c6ba52ec-c1de-46ac-950b-f5354c6785ac";

export const DATA_TEST_ID = {
  FEEDBACK_FORM_DIALOG: `feedback-form-dialog-${uniqueId}`,
  FEEDBACK_FORM_DIALOG_TITLE: `feedback-form-dialog-title-${uniqueId}`,
  FEEDBACK_FORM_DIALOG_BUTTON: `feedback-form-dialog-button-${uniqueId}`,
  FEEDBACK_FORM_DIALOG_ICON_BUTTON: `feedback-form-dialog-icon-button-${uniqueId}`,
  FEEDBACK_FORM_DIALOG_CONTENT: `feedback-form-dialog-content-${uniqueId}`,
};

const FeedbackForm: React.FC<FeedbackFormProps> = ({ isOpen, notifyOnClose }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isSmallOrShortScreen = useIsSmallOrShortScreen();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleClose = () => {
    notifyOnClose(FeedbackCloseEvent.DISMISS);
  };

  const handleFeedbackSubmit = async (formData: FeedbackItem[]): Promise<void> => {
    setIsSubmitting(true);
    notifyOnClose(FeedbackCloseEvent.SUBMIT);
    try {
      const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();
      if (!userPreferences?.sessions.length) {
        throw new Error("User has no sessions");
      }

      const sessionId = userPreferences.sessions[0];
      const overallFeedbackService = OverallFeedbackService.getInstance();
      await overallFeedbackService.sendFeedback(sessionId, formData);

      enqueueSnackbar(t("feedback.overallFeedback.feedbackForm.submitSuccess"), { variant: "success" });
    } catch (error) {
      console.error(new FeedbackError("Failed to submit feedback", error));
      enqueueSnackbar(t("feedback.overallFeedback.feedbackForm.submitError"), { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth={true}
        fullScreen={isSmallOrShortScreen}
        data-testid={DATA_TEST_ID.FEEDBACK_FORM_DIALOG}
        sx={{
          "& .MuiDialog-paper": {
            height: isSmallOrShortScreen ? "100%" : "85%",
            display: "flex",
            flexDirection: "column",
            gap: theme.fixedSpacing(isSmallOrShortScreen ? theme.tabiyaSpacing.sm : theme.tabiyaSpacing.lg),
            margin: 0,
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding:
              isSmallOrShortScreen
                ? theme.fixedSpacing(theme.tabiyaSpacing.sm)
                : theme.fixedSpacing(theme.tabiyaSpacing.md),
            paddingBottom: 0,
          }}
        >
          <Typography variant="h3" data-testid={DATA_TEST_ID.FEEDBACK_FORM_DIALOG_TITLE}>
            {t("feedback.overallFeedback.feedbackForm.helpUsImprove")}
          </Typography>
          <PrimaryIconButton
            onClick={handleClose}
            title={t("feedback.overallFeedback.feedbackForm.closeForm")}
            sx={{ color: theme.palette.text.secondary }}
            data-testid={DATA_TEST_ID.FEEDBACK_FORM_DIALOG_BUTTON}
          >
            <CloseIcon data-testid={DATA_TEST_ID.FEEDBACK_FORM_DIALOG_ICON_BUTTON} />
          </PrimaryIconButton>
        </DialogTitle>
        <DialogContent
          data-testid={DATA_TEST_ID.FEEDBACK_FORM_DIALOG_CONTENT}
          sx={{
            padding:
              isSmallOrShortScreen
                ? theme.fixedSpacing(theme.tabiyaSpacing.sm)
                : theme.fixedSpacing(theme.tabiyaSpacing.md),
          }}
        >
          <FeedbackFormContent notifySubmit={handleFeedbackSubmit} />
        </DialogContent>
      </Dialog>
      <Backdrop isShown={isSubmitting} message={t("feedback.overallFeedback.feedbackForm.submittingFeedback")} />
    </>
  );
};

export default FeedbackForm;
