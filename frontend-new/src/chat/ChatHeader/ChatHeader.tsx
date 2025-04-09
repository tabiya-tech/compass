import React, { SetStateAction, useContext, useEffect, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { NavLink } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import PermIdentityIcon from "@mui/icons-material/PermIdentity";
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

export type ChatHeaderProps = {
  notifyOnLogout: () => void;
  startNewConversation: () => void;
  notifyOnExperiencesDrawerOpen: () => void;
  experiencesExplored: number;
  exploredExperiencesNotification: boolean;
  setExploredExperiencesNotification: React.Dispatch<SetStateAction<boolean>>;
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
  notifyOnExperiencesDrawerOpen,
  experiencesExplored,
  exploredExperiencesNotification,
  setExploredExperiencesNotification,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const isOnline = useContext(IsOnlineContext);
  const user = authenticationStateService.getInstance().getUser();
  const isAnonymous = !user?.name || !user?.email;
  const { setIsAccountConverted } = useChatContext();
  const [sentryEnabled, setSentryEnabled] = useState(false);

  const handleViewExperiences = () => {
    notifyOnExperiencesDrawerOpen();
    setExploredExperiencesNotification(false);
  };

  useEffect(() => {
    setSentryEnabled(Sentry.isInitialized());
  }, []);

  const handleGiveFeedback = async () => {
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
      }
    } catch (error) {
      console.error("Error creating feedback form:", error);
    }
  };

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
        action: notifyOnLogout,
      },
    ],
    [isAnonymous, isOnline, notifyOnLogout, startNewConversation, sentryEnabled]
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
          <AnimatedBadge badgeContent={experiencesExplored} invisible={!exploredExperiencesNotification}>
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
          <PermIdentityIcon data-testid={DATA_TEST_ID.CHAT_HEADER_ICON_USER} />
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
    </Box>
  );
};

export default ChatHeader;
