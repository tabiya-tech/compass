import React from "react";
import { Dialog, DialogContent, DialogTitle, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import FeedbackFormContent from "src/feedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import CloseIcon from "@mui/icons-material/Close";
import FeedbackService from "src/feedback/feedbackForm/feedbackFormService/feedbackFormService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { FeedbackItem } from "src/feedback/feedbackForm/feedbackFormService/feedbackFormService.types";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import { FeedbackError } from "src/error/commonErrors";

export interface FeedbackFormProps {
  isOpen: boolean;
  notifyOnClose: (event: { name: CloseEventName }) => void;
  onFeedbackSubmit: () => void;
}

export enum CloseEventName {
  DISMISS = "DISMISS",
}

const uniqueId = "c6ba52ec-c1de-46ac-950b-f5354c6785ac";

export const DATA_TEST_ID = {
  FEEDBACK_FORM_DIALOG: `feedback-form-dialog-${uniqueId}`,
  FEEDBACK_FORM_DIALOG_TITLE: `feedback-form-dialog-title-${uniqueId}`,
  FEEDBACK_FORM_DIALOG_BUTTON: `feedback-form-dialog-button-${uniqueId}`,
  FEEDBACK_FORM_DIALOG_ICON_BUTTON: `feedback-form-dialog-icon-button-${uniqueId}`,
  FEEDBACK_FORM_DIALOG_CONTENT: `feedback-form-dialog-content-${uniqueId}`,
};

const FeedbackForm: React.FC<FeedbackFormProps> = ({ isOpen, notifyOnClose, onFeedbackSubmit }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleClose = () => {
    notifyOnClose({ name: CloseEventName.DISMISS });
  };

  const handleFeedbackSubmit = async (formData: FeedbackItem[]): Promise<void> => {
    setIsSubmitting(true);
    handleClose();
    try {
      const userPreferences = userPreferencesStateService.getUserPreferences();
      if (!userPreferences?.sessions.length) {
        throw new Error("User has no sessions");
      }

      const sessionId = userPreferences.sessions[0];
      const feedbackService = new FeedbackService(sessionId);
      await feedbackService.sendFeedback(formData);

      enqueueSnackbar("Feedback submitted successfully!", { variant: "success" });
      onFeedbackSubmit();
    } catch (error) {
      console.error(new FeedbackError("Failed to submit feedback", error as Error));
      enqueueSnackbar("Failed to submit feedback. Please try again later.", { variant: "error" });
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
        fullScreen={isSmallMobile}
        data-testid={DATA_TEST_ID.FEEDBACK_FORM_DIALOG}
        sx={{
          "& .MuiDialog-paper": {
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing(4),
          },
        }}
      >
        <DialogTitle component="div" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h3" data-testid={DATA_TEST_ID.FEEDBACK_FORM_DIALOG_TITLE}>
            Help us improve!
          </Typography>
          <PrimaryIconButton
            onClick={handleClose}
            title="close feedback form"
            sx={{ color: theme.palette.text.secondary }}
            data-testid={DATA_TEST_ID.FEEDBACK_FORM_DIALOG_BUTTON}
          >
            <CloseIcon data-testid={DATA_TEST_ID.FEEDBACK_FORM_DIALOG_ICON_BUTTON} />
          </PrimaryIconButton>
        </DialogTitle>
        <DialogContent data-testid={DATA_TEST_ID.FEEDBACK_FORM_DIALOG_CONTENT}>
          <FeedbackFormContent notifySubmit={handleFeedbackSubmit} />
        </DialogContent>
      </Dialog>
      <Backdrop isShown={isSubmitting} message="Submitting feedback..." />
    </>
  );
};

export default FeedbackForm;
