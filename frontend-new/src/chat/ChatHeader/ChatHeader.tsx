import React, { SetStateAction, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { SessionError } from "src/error/commonErrors";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { useSentryFeedbackForm } from "src/feedback/hooks/useSentryFeedbackForm";

export type ChatHeaderProps = {
  experiencesExplored: number;
  exploredExperiencesNotification: boolean;
  setExploredExperiencesNotification: React.Dispatch<SetStateAction<boolean>>;
  conversationCompleted: boolean;
  timeUntilNotification: number | null;
  progressPercentage: number;
};

const uniqueId = "7413b63a-887b-4f41-b930-89e9770db12b";
export const DATA_TEST_ID = {
  CHAT_HEADER_CONTAINER: `chat-header-container-${uniqueId}`,
  CHAT_HEADER_FEEDBACK_LINK: `chat-header-feedback-link-${uniqueId}`,
};

const ChatHeader: React.FC<Readonly<ChatHeaderProps>> = ({
  experiencesExplored,
  exploredExperiencesNotification,
  setExploredExperiencesNotification,
  conversationCompleted,
  timeUntilNotification,
  progressPercentage,
}) => {
  const { t } = useTranslation();
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notificationShownRef = useRef<boolean>(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { openFeedbackForm, feedbackModalElement } = useSentryFeedbackForm();

  const handleGiveFeedback = useCallback(async () => {
    await openFeedbackForm({ markNotificationSeen: true });
  }, [openFeedbackForm]);

  // Show feedback reminder snackbar after 30 minutes if conversation is not completed.
  // This component is only mounted on the skills & interests (chat) page, so the reminder never runs on other pages.
  useEffect(() => {
    const user = authenticationStateService.getInstance().getUser();
    if (!user) {
      console.error(new SessionError("User is not available"));
      return;
    }

    // Clean up any existing timer
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    // Don't set a timer if conversation is completed, notification already shown, or no time was given
    if (
      conversationCompleted ||
      PersistentStorageService.hasSeenFeedbackNotification(user.id) ||
      timeUntilNotification === null ||
      notificationShownRef.current
    ) {
      return;
    }

    feedbackTimerRef.current = setTimeout(() => {
      if (conversationCompleted) {
        // Don't show a notification if the conversation is completed
        return;
      }

      // Check if phase progress is 66% or less
      const shouldPrompt: boolean = (progressPercentage ?? 0) <= 66;

      if (shouldPrompt && !notificationShownRef.current) {
        const snackbarKey = enqueueSnackbar(
          <Typography variant="body1">
            {t("chat.chatHeader.feedbackMessage")}{" "}
            <CustomLink
              onClick={async () => {
                closeSnackbar(snackbarKey);
                await handleGiveFeedback();
              }}
              data-testid={DATA_TEST_ID.CHAT_HEADER_FEEDBACK_LINK}
            >
              {t("chat.chatHeader.giveFeedback")}
            </CustomLink>
          </Typography>,
          {
            variant: "info",
            persist: true,
            autoHideDuration: null,
            preventDuplicate: true,
          }
        );
        // Mark the notification as shown
        notificationShownRef.current = true;
      }
    }, timeUntilNotification);

    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [
    enqueueSnackbar,
    closeSnackbar,
    conversationCompleted,
    handleGiveFeedback,
    timeUntilNotification,
    progressPercentage,
    t,
  ]);

  return (
    <>
      <Box
        display="flex"
        justifyContent="flex-end"
        alignItems="center"
        data-testid={DATA_TEST_ID.CHAT_HEADER_CONTAINER}
      />
      {feedbackModalElement}
    </>
  );
};

export default ChatHeader;
