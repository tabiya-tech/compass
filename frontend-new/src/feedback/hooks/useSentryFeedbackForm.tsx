import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import FeedbackModal, {
  FeedbackModalSubmitPayload,
} from "src/feedback/feedbackModal/FeedbackModal";

interface OpenFeedbackFormOptions {
  markNotificationSeen?: boolean;
}

interface UseSentryFeedbackFormOptions {
  markNotificationSeenOnOpen?: boolean;
}

export const useSentryFeedbackForm = (options: UseSentryFeedbackFormOptions = {}) => {
  const { markNotificationSeenOnOpen = false } = options;
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [sentryEnabled, setSentryEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setSentryEnabled(Sentry.isInitialized());
  }, []);

  const openFeedbackForm = useCallback(
    async (openOptions: OpenFeedbackFormOptions = {}): Promise<boolean> => {
      if (!sentryEnabled) {
        console.debug("Sentry is not initialized, feedback form cannot be created.");
        return false;
      }

      setIsOpen(true);

      const shouldMarkAsSeen = openOptions.markNotificationSeen ?? markNotificationSeenOnOpen;
      if (shouldMarkAsSeen) {
        const user = authenticationStateService.getInstance().getUser();
        if (user) {
          PersistentStorageService.setSeenFeedbackNotification(user.id);
        }
      }

      return true;
    },
    [markNotificationSeenOnOpen, sentryEnabled]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSubmit = useCallback(
    (payload: FeedbackModalSubmitPayload) => {
      try {
        const user = authenticationStateService.getInstance().getUser();
        Sentry.captureFeedback(
          {
            name: user?.name,
            email: user?.email,
            message: payload.message,
            tags: {
              "feedback.type": payload.type,
              "feedback.priority": payload.priority,
            },
          },
          { includeReplay: true }
        );
        enqueueSnackbar(t("feedback.feedbackModal.successMessage"), { variant: "success" });
      } catch (error) {
        console.error("Error sending feedback to Sentry:", error);
        enqueueSnackbar(t("feedback.feedbackModal.errorMessage"), { variant: "error" });
      }
    },
    [enqueueSnackbar, t]
  );

  const feedbackModalElement = useMemo(
    () => <FeedbackModal isOpen={isOpen} onClose={handleClose} onSubmit={handleSubmit} />,
    [isOpen, handleClose, handleSubmit]
  );

  return {
    sentryEnabled,
    openFeedbackForm,
    feedbackModalElement,
  };
};
