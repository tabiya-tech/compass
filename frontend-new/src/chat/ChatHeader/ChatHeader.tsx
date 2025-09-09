import React, { SetStateAction, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { NavLink } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import AnimatedBadge from "src/theme/AnimatedBadge/AnimatedBadge";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import * as Sentry from "@sentry/react";
import AnonymousAccountConversionDialog from "src/auth/components/anonymousAccountConversionDialog/AnonymousAccountConversionDialog";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { useChatContext } from "src/chat/ChatContext";
import InfoDrawer from "src/info/Info";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { SessionError } from "src/error/commonErrors";
import TextConfirmModalDialog from "src/theme/textConfirmModalDialog/TextConfirmModalDialog";
import { HighlightedSpan } from "src/consent/components/consentPage/Consent";
import MetricsService from "src/metrics/metricsService";
import { EventType } from "src/metrics/types";
import { MetricsError } from "src/error/commonErrors";
import { ConversationPhase } from "src/chat/chatProgressbar/types";

export type ChatHeaderProps = {
  notifyOnLogout: () => void;
  startNewConversation: () => void;
  experiencesExplored: number;
  exploredExperiencesNotification: boolean;
  setExploredExperiencesNotification: React.Dispatch<SetStateAction<boolean>>;
  conversationCompleted: boolean;
  timeUntilNotification: number | null;
  progressPercentage: number;
  conversationPhase: ConversationPhase;
  collectedExperiences: number;
};

const uniqueId = "7413b63a-887b-4f41-b930-89e9770db12b";
export const DATA_TEST_ID = {
  CHAT_HEADER_CONTAINER: `chat-header-container-${uniqueId}`,
  CHAT_HEADER_LOGO: `chat-header-logo-${uniqueId}`,
  CHAT_HEADER_LOGO_LINK: `chat-header-logo-link-${uniqueId}`,
  CHAT_HEADER_ICON_USER: `chat-header-icon-user-${uniqueId}`,
  CHAT_HEADER_BUTTON_USER: `chat-header-button-user-${uniqueId}`,
  CHAT_HEADER_ICON_EXPERIENCES: `chat-header-icon-experiences-${uniqueId}`,
  CHAT_HEADER_BUTTON_EXPERIENCES: `chat-header-button-experiences-${uniqueId}`,
  CHAT_HEADER_BUTTON_FEEDBACK: `chat-header-button-feedback-${uniqueId}`,
  CHAT_HEADER_ICON_FEEDBACK: `chat-header-icon-feedback-${uniqueId}`,
  CHAT_HEADER_FEEDBACK_LINK: `chat-header-feedback-link-${uniqueId}`,
};

export const MENU_ITEM_ID = {
  SETTINGS_SELECTOR: `settings-selector-${uniqueId}`,
  LOGOUT_BUTTON: `logout-button-${uniqueId}`,
  START_NEW_CONVERSATION: `start-new-conversation-${uniqueId}`,
  REPORT_BUG_BUTTON: `report-bug-button-${uniqueId}`,
  REGISTER: `register-${uniqueId}`,
};

export const MENU_ITEM_TEXT = {
  SETTINGS: "settings",
  LOGOUT: "logout",
  START_NEW_CONVERSATION: "start new conversation",
  REPORT_BUG: "report a bug",
  REGISTER: "register",
};

export const FEEDBACK_FORM_TEXT = {
  TITLE: "Give general feedback",
  MESSAGE_PLACEHOLDER:
    "We'd love to hear your thoughts! Please share any feedback or suggestions you have for improving Compass.",
  SUBMIT_BUTTON_LABEL: "Send Feedback",
  SUCCESS_MESSAGE: "Thank you for your feedback!",
};

const ChatHeader: React.FC<Readonly<ChatHeaderProps>> = ({
  notifyOnLogout,
  startNewConversation,
  experiencesExplored,
  exploredExperiencesNotification,
  setExploredExperiencesNotification,
  conversationCompleted,
  timeUntilNotification,
  progressPercentage,
  conversationPhase,
  collectedExperiences,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const feedbackTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const notificationShownRef = React.useRef<boolean>(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const isOnline = useContext(IsOnlineContext);
  const user = authenticationStateService.getInstance().getUser();
  const isAnonymous = !user?.name || !user?.email;
  const { setIsAccountConverted, handleOpenExperiencesDrawer } = useChatContext();
  const [sentryEnabled, setSentryEnabled] = useState(false);

  const handleLogout = useCallback(() => {
    if (isAnonymous) {
      setShowLogoutConfirmation(true);
    } else {
      notifyOnLogout();
    }
  }, [isAnonymous, notifyOnLogout]);

  const handleConfirmLogout = () => {
    setShowLogoutConfirmation(false);
    notifyOnLogout();
  };

  const handleRegister = () => {
    setShowLogoutConfirmation(false);
    setShowConversionDialog(true);
  };

  const handleViewExperiences = () => {
    handleOpenExperiencesDrawer();
    setExploredExperiencesNotification(false);
    try {
      const user_id = authenticationStateService.getInstance().getUser()?.id;
      if (!user_id) {
        console.error(new MetricsError("Unable to send Experiences and Skills view metrics: user id is missing"));
        return;
      }

      MetricsService.getInstance().sendMetricsEvent({
        event_type: EventType.UI_INTERACTION,
        user_id: user_id,
        actions: ["view_experiences_and_skills"],
        element_id: DATA_TEST_ID.CHAT_HEADER_BUTTON_EXPERIENCES,
        timestamp: new Date().toISOString(),
        relevant_experiments: {},
        details: {
          conversation_phase: conversationPhase,
          experiences_explored: experiencesExplored,
          collected_experiences: collectedExperiences,
        },
      });
    } catch (error) {
      console.error(new MetricsError(`Unable to send Experiences and Skills view metrics: ${error}`));
    }
  };

  useEffect(() => {
    setSentryEnabled(Sentry.isInitialized());
  }, []);

  const handleGiveFeedback = useCallback(async () => {
    if (!sentryEnabled) {
      console.warn("Sentry is not initialized, feedback form cannot be created.");
      return;
    }
    try {
      const feedback = Sentry.getFeedback();
      if (feedback) {
        const form = await feedback.createForm({
          formTitle: FEEDBACK_FORM_TEXT.TITLE,
          messagePlaceholder: FEEDBACK_FORM_TEXT.MESSAGE_PLACEHOLDER,
          submitButtonLabel: FEEDBACK_FORM_TEXT.SUBMIT_BUTTON_LABEL,
          successMessageText: FEEDBACK_FORM_TEXT.SUCCESS_MESSAGE,
          enableScreenshot: false,
        });
        form.appendToDom();
        form.open();
        // Set feedback notification as seen when user opens the feedback form
        const user = authenticationStateService.getInstance().getUser();
        if (user) {
          PersistentStorageService.setSeenFeedbackNotification(user.id);
        }
      }
    } catch (error) {
      console.error("Error creating feedback form:", error);
    }
  }, [sentryEnabled]);

  // Show notification after 30 minutes if conversation is not completed
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

    // Don't set timer if conversation is completed, notification already shown, or no time was given
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
            We'd love to hear your feedback on your experience so far!{" "}
            <CustomLink
              onClick={async () => {
                closeSnackbar(snackbarKey);
                await handleGiveFeedback();
              }}
              data-testid={DATA_TEST_ID.CHAT_HEADER_FEEDBACK_LINK}
            >
              Give Feedback
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
  ]);

  const contextMenuItems: MenuItemConfig[] = useMemo(
    () => [
      {
        id: MENU_ITEM_ID.START_NEW_CONVERSATION,
        text: MENU_ITEM_TEXT.START_NEW_CONVERSATION,
        disabled: !isOnline,
        action: startNewConversation,
      },
      {
        id: MENU_ITEM_ID.SETTINGS_SELECTOR,
        text: MENU_ITEM_TEXT.SETTINGS,
        disabled: !isOnline,
        action: () => setIsDrawerOpen(true),
      },
      ...(sentryEnabled
        ? [
            {
              id: MENU_ITEM_ID.REPORT_BUG_BUTTON,
              text: MENU_ITEM_TEXT.REPORT_BUG,
              disabled: !isOnline,
              action: () => {
                const feedback = Sentry.getFeedback();
                if (feedback) {
                  feedback.createForm().then((form) => {
                    if (form) {
                      form.appendToDom();
                      form.open();
                    }
                  });
                }
              },
            },
          ]
        : []),
      ...(isAnonymous
        ? [
            {
              id: MENU_ITEM_ID.REGISTER,
              text: MENU_ITEM_TEXT.REGISTER,
              disabled: !isOnline,
              action: () => setShowConversionDialog(true),
            },
          ]
        : []),
      {
        id: MENU_ITEM_ID.LOGOUT_BUTTON,
        text: MENU_ITEM_TEXT.LOGOUT,
        disabled: false,
        action: handleLogout,
      },
    ],
    [isAnonymous, isOnline, startNewConversation, sentryEnabled, handleLogout]
  );

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      data-testid={DATA_TEST_ID.CHAT_HEADER_CONTAINER}
    >
      <NavLink style={{ lineHeight: 0 }} to={routerPaths.ROOT} data-testid={DATA_TEST_ID.CHAT_HEADER_LOGO_LINK}>
        <img
          src={`${process.env.PUBLIC_URL}/compass.svg`}
          alt="Compass Logo"
          height={12 * theme.tabiyaSpacing.xl} // xl wasn't quite big enough, we're going for ~48px
          data-testid={DATA_TEST_ID.CHAT_HEADER_LOGO}
        />
      </NavLink>
      <Typography variant="h1">Compass</Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexDirection: "row",
          gap: theme.spacing(theme.tabiyaSpacing.lg),
        }}
      >
        <PrimaryIconButton
          sx={{
            color: theme.palette.common.black,
          }}
          onClick={handleViewExperiences}
          data-testid={DATA_TEST_ID.CHAT_HEADER_BUTTON_EXPERIENCES}
          title="view experiences"
          disabled={!isOnline}
        >
          <AnimatedBadge
            badgeContent={experiencesExplored}
            invisible={!exploredExperiencesNotification || experiencesExplored === 0}
          >
            <BadgeOutlinedIcon data-testid={DATA_TEST_ID.CHAT_HEADER_ICON_EXPERIENCES} />
          </AnimatedBadge>
        </PrimaryIconButton>
        {sentryEnabled && (
          <PrimaryIconButton
            sx={{
              color: theme.palette.common.black,
            }}
            onClick={handleGiveFeedback}
            data-testid={DATA_TEST_ID.CHAT_HEADER_BUTTON_FEEDBACK}
            title="give feedback"
            disabled={!isOnline}
          >
            <FeedbackOutlinedIcon data-testid={DATA_TEST_ID.CHAT_HEADER_ICON_FEEDBACK} />
          </PrimaryIconButton>
        )}
        <PrimaryIconButton
          sx={{
            color: theme.palette.common.black,
          }}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          data-testid={DATA_TEST_ID.CHAT_HEADER_BUTTON_USER}
          title="user info"
        >
          <img
            src={`${process.env.PUBLIC_URL}/user-icon.svg`}
            alt="User Icon"
            data-testid={DATA_TEST_ID.CHAT_HEADER_ICON_USER}
          />
        </PrimaryIconButton>
      </Box>
      <ContextMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        notifyOnClose={() => setAnchorEl(null)}
        items={contextMenuItems}
      />
      <AnonymousAccountConversionDialog
        isOpen={showConversionDialog}
        onClose={() => setShowConversionDialog(false)}
        onSuccess={() => {
          setIsAccountConverted(true);
        }}
      />
      <InfoDrawer isOpen={isDrawerOpen} notifyOnClose={() => setIsDrawerOpen(false)} />
      <TextConfirmModalDialog
        isOpen={showLogoutConfirmation}
        onCancel={handleConfirmLogout}
        onDismiss={() => setShowLogoutConfirmation(false)}
        onConfirm={handleRegister}
        title="Before you go"
        confirmButtonText="Register"
        cancelButtonText="Logout"
        showCloseIcon={true}
        textParagraphs={[
          {
            id: "1",
            text: <>Are you sure you want to log out?</>,
          },
          {
            id: "2",
            text: (
              <>
                You're currently using an anonymous account.
                <HighlightedSpan>
                  {" "}
                  If you log out, you'll lose access to your conversation history and experiences
                </HighlightedSpan>
                .
              </>
            ),
          },
          {
            id: "3",
            text: (
              <>
                <HighlightedSpan>Create an account to save your progress</HighlightedSpan> and continue your journey
                later.
              </>
            ),
          },
        ]}
      />
    </Box>
  );
};

export default ChatHeader;
