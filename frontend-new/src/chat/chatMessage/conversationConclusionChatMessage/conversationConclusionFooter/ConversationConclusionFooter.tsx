import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, useTheme } from "@mui/material";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { FIXED_MESSAGES_TEXT } from "src/chat/util";
import FeedbackForm, {
  FeedbackStatus,
  FeedbackCloseEvent,
} from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";
import { useChatContext } from "src/chat/ChatContext";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import AnonymousAccountConversionDialog from "src/auth/components/anonymousAccountConversionDialog/AnonymousAccountConversionDialog";
import CustomerSatisfactionRating from "src/feedback/overallFeedback/feedbackForm/components/customerSatisfactionRating/CustomerSatisfaction";
import PermIdentityIcon from "@mui/icons-material/PermIdentity";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";

const StyledCustomLink: React.FC<React.ComponentProps<typeof CustomLink>> = (props) => {
  const theme = useTheme();
  return (
    <CustomLink
      {...props}
      style={{
        display: "inline-flex",
        flexDirection: "row",
        gap: theme.spacing(theme.tabiyaSpacing.xs),
        verticalAlign: "bottom",
        ...props.style
      }}
    />
  );
};

const uniqueId = "41675f8b-257c-4a63-9563-3fe9feb6a850";

export const DATA_TEST_ID = {
  CONVERSATION_CONCLUSION_FOOTER_CONTAINER: `feedback-form-button-container-${uniqueId}`,
  FEEDBACK_FORM_BUTTON: `feedback-form-button-${uniqueId}`,
  EXPERIENCES_DRAWER_BUTTON: `feedback-form-experiences-drawer-button-${uniqueId}`,
  FEEDBACK_IN_PROGRESS_BUTTON: `feedback-in-progress-button-${uniqueId}`,
  FEEDBACK_MESSAGE_TEXT: `feedback-message-text-${uniqueId}`,
  FEEDBACK_IN_PROGRESS_MESSAGE: `feedback-in-progress-message-${uniqueId}`,
  THANK_YOU_FOR_FEEDBACK_MESSAGE: `thank-you-for-feedback-message-${uniqueId}`,
  THANK_YOU_FOR_RATING_MESSAGE: `thank-you-for-rating-message${uniqueId}`,
  CREATE_ACCOUNT_LINK: `create-account-link-${uniqueId}`,
  CREATE_ACCOUNT_MESSAGE: `create-account-message-${uniqueId}`,
  VERIFICATION_REMINDER_MESSAGE: `verification-reminder-message-${uniqueId}`,
};

const ConversationConclusionFooter: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { feedbackStatus, setFeedbackStatus, handleOpenExperiencesDrawer } = useChatContext();

  const [feedbackData, setFeedbackData] = useState<FeedbackItem[]>(PersistentStorageService.getOverallFeedback());
  const [sessionHasFeedback, setSessionHasFeedback] = useState<boolean>(
    UserPreferencesStateService.getInstance().activeSessionHasOverallFeedback()
  );
  const [isFeedbackFormOpen, setIsFeedbackFormOpen] = useState<boolean>(false);
  const [showConversionDialog, setShowConversionDialog] = useState<boolean>(false);
  const [hasSubmittedCustomerSatisfactionRating, setHasSubmittedCustomerSatisfactionRating] = useState<boolean>(
    UserPreferencesStateService.getInstance().activeSessionHasCustomerSatisfactionRating()
  );

  const user = authenticationStateService.getInstance().getUser();
  const isAnonymous = !user?.name || !user?.email;
  const { isAccountConverted, setIsAccountConverted } = useChatContext();

  // Check local storage when the form is closed to see if there is saved feedback
  useEffect(() => {
    if (!isFeedbackFormOpen) {
      const updatedFeedbackData = PersistentStorageService.getOverallFeedback();
      if (JSON.stringify(feedbackData) !== JSON.stringify(updatedFeedbackData)) {
        setFeedbackData(updatedFeedbackData);
        // If there is feedback data, set the feedback status to started
        if (updatedFeedbackData.length > 0 && feedbackStatus === FeedbackStatus.NOT_STARTED) {
          setFeedbackStatus(FeedbackStatus.STARTED);
        }
      }
    }
  }, [isFeedbackFormOpen, feedbackData, feedbackStatus, setFeedbackStatus]);

  // Update feedback status based on session feedback state
  useEffect(() => {
    if (sessionHasFeedback) {
      setFeedbackStatus(FeedbackStatus.SUBMITTED);
    } else if (feedbackData.length > 0) {
      setFeedbackStatus(FeedbackStatus.STARTED);
    }
  }, [feedbackData.length, sessionHasFeedback, setFeedbackStatus]);


  const handleFeedbackFormClose = (closeEvent: FeedbackCloseEvent) => {
    setIsFeedbackFormOpen(false);
    if (closeEvent === FeedbackCloseEvent.SUBMIT) {
      setFeedbackStatus(FeedbackStatus.SUBMITTED);
      setSessionHasFeedback(true);
    } else if (closeEvent === FeedbackCloseEvent.DISMISS) {
      if (feedbackData.length > 0) {
        setFeedbackStatus(FeedbackStatus.STARTED);
      } else {
        setFeedbackStatus(FeedbackStatus.NOT_STARTED);
      }
    }
  };

  const feedbackSubmitted = (sessionHasFeedback || feedbackStatus === FeedbackStatus.SUBMITTED);

  return (
    <>
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="start"
        gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
        marginTop={theme.fixedSpacing(theme.tabiyaSpacing.md)}
        data-testid={DATA_TEST_ID.CONVERSATION_CONCLUSION_FOOTER_CONTAINER}
      >
        <Typography variant="body1">          
           {t("chat.chatMessage.conversationConclusionFooter.youCanNow")}{" "}                                   
          <StyledCustomLink
            onClick={handleOpenExperiencesDrawer}
            disableWhenOffline
            data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_BUTTON}
          >
           <BadgeOutlinedIcon />
            {t("chat.chatMessage.conversationConclusionFooter.viewAndDownloadCv")}
          </StyledCustomLink>{" "}
          {t("chat.chatMessage.conversationConclusionFooter.here")}
          {/* Show anonymous user registration link if the user is anonymous and hasn't already converted */}
          {isAnonymous && !isAccountConverted && (
            <span data-testid={DATA_TEST_ID.CREATE_ACCOUNT_MESSAGE}>
              {t("chat.chatMessage.conversationConclusionFooter.createAccountIntro")} {" "}
              <StyledCustomLink
                onClick={() => setShowConversionDialog(true)}
                disableWhenOffline
                data-testid={DATA_TEST_ID.CREATE_ACCOUNT_LINK}
              >
                <PermIdentityIcon />
                {t("chat.chatMessage.conversationConclusionFooter.createAccount")}
              </StyledCustomLink>
            </span>
          )}
          {/* Show the verification reminder if the user has already converted their account */}
          {isAccountConverted && (
            <span data-testid={DATA_TEST_ID.VERIFICATION_REMINDER_MESSAGE}>
              {t("chat.chatMessage.conversationConclusionFooter.verificationReminder")}
            </span>
          )}
        </Typography>

        <Typography component={"span"} variant="body1">
          {/* Show a customer satisfaction rating if it hasn't been submitted yet */}
          {!hasSubmittedCustomerSatisfactionRating && (
            <CustomerSatisfactionRating
              notifyOnCustomerSatisfactionRatingSubmitted={() => setHasSubmittedCustomerSatisfactionRating(true)}
            />
          )}
          {/* Show a thank you message if the rating has been submitted */}
          {hasSubmittedCustomerSatisfactionRating && !feedbackSubmitted && (
            <span data-testid={DATA_TEST_ID.THANK_YOU_FOR_RATING_MESSAGE}>
              {" "}
              {FIXED_MESSAGES_TEXT.THANK_YOU_FOR_RATING}{" "}
            </span>
          )}
          {/* Show feedback form if the rating has been submitted */}
          {hasSubmittedCustomerSatisfactionRating && feedbackStatus === FeedbackStatus.NOT_STARTED && (
            <span data-testid={DATA_TEST_ID.FEEDBACK_MESSAGE_TEXT}>{" "}
              {t("chat.chatMessage.conversationConclusionFooter.feedbackWelcome")} {" "}
              <StyledCustomLink
                onClick={() => setIsFeedbackFormOpen(true)}
                disableWhenOffline
                data-testid={DATA_TEST_ID.FEEDBACK_FORM_BUTTON}
              >
                <FeedbackOutlinedIcon />
                {t("chat.chatMessage.conversationConclusionFooter.feedbackLinkText")}
              </StyledCustomLink>{" "}
              {t("chat.chatMessage.conversationConclusionFooter.feedbackFromYouSuffix")}
            </span>
          )}
          {/* Show continue feedback if the status is already started */}
          {hasSubmittedCustomerSatisfactionRating && feedbackStatus === FeedbackStatus.STARTED && (
            <span data-testid={DATA_TEST_ID.FEEDBACK_IN_PROGRESS_MESSAGE}>
              {t("chat.chatMessage.conversationConclusionFooter.feedbackInProgressPrefix")} {" "}
              <StyledCustomLink
                onClick={() => setIsFeedbackFormOpen(true)}
                disableWhenOffline
                data-testid={DATA_TEST_ID.FEEDBACK_IN_PROGRESS_BUTTON}
              >
                <FeedbackOutlinedIcon />
                {t("chat.chatMessage.conversationConclusionFooter.feedbackInProgressLinkText")}
              </StyledCustomLink>{" "}
              {t("chat.chatMessage.conversationConclusionFooter.feedbackInProgressSuffix")}
            </span>
          )}
          {feedbackSubmitted && hasSubmittedCustomerSatisfactionRating && (
            <span data-testid={DATA_TEST_ID.THANK_YOU_FOR_FEEDBACK_MESSAGE}>
              {FIXED_MESSAGES_TEXT.THANK_YOU_FOR_FEEDBACK}
            </span>
          )}
        </Typography>
      </Box>
      <FeedbackForm isOpen={isFeedbackFormOpen} notifyOnClose={handleFeedbackFormClose} />
      <AnonymousAccountConversionDialog
        isOpen={showConversionDialog}
        onClose={() => setShowConversionDialog(false)}
        onSuccess={() => {
          setIsAccountConverted(true);
        }}
      />
    </>
  );
};

export default ConversationConclusionFooter;
