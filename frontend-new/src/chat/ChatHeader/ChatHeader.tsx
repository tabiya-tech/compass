import React, { useContext, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { NavLink, useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import PermIdentityIcon from "@mui/icons-material/PermIdentity";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import * as Sentry from "@sentry/react";

export type ChatHeaderProps = {
  notifyOnLogout: () => void;
  startNewConversation: () => void;
  notifyOnExperiencesDrawerOpen: () => void;
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
};

export const MENU_ITEM_ID = {
  SETTINGS_SELECTOR: `settings-selector-${uniqueId}`,
  LOGOUT_BUTTON: `logout-button-${uniqueId}`,
  START_NEW_CONVERSATION: `start-new-conversation-${uniqueId}`,
  REPORT_BUG_BUTTON: `report-bug-button-${uniqueId}`,
};

export const MENU_ITEM_TEXT = {
  SETTINGS: "settings",
  LOGOUT: "logout",
  START_NEW_CONVERSATION: "start new conversation",
  REPORT_BUG: "report a bug",
};

const ChatHeader: React.FC<Readonly<ChatHeaderProps>> = ({
  notifyOnLogout,
  startNewConversation,
  notifyOnExperiencesDrawerOpen,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const isOnline = useContext(IsOnlineContext);
  const contextMenuItems: MenuItemConfig[] = [
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
      action: () => {
        navigate(routerPaths.SETTINGS);
      },
    },
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
    {
      id: MENU_ITEM_ID.LOGOUT_BUTTON,
      text: MENU_ITEM_TEXT.LOGOUT,
      disabled: !isOnline,
      action: notifyOnLogout,
    },
  ];

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      data-testid={DATA_TEST_ID.CHAT_HEADER_CONTAINER}
      padding={theme.spacing(theme.tabiyaSpacing.md)}
    >
      <NavLink style={{ lineHeight: 0 }} to={routerPaths.ROOT} data-testid={DATA_TEST_ID.CHAT_HEADER_LOGO_LINK}>
        <img
          src={`${process.env.PUBLIC_URL}/compass.svg`}
          alt="Compass"
          height="48px"
          data-testid={DATA_TEST_ID.CHAT_HEADER_LOGO}
        />
      </NavLink>
      <Typography variant="h1">Compass</Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexDirection: "row",
          gap: theme.spacing(theme.tabiyaSpacing.md),
        }}
      >
        <PrimaryIconButton
          sx={{
            color: theme.palette.common.black,
          }}
          onClick={notifyOnExperiencesDrawerOpen}
          data-testid={DATA_TEST_ID.CHAT_HEADER_BUTTON_EXPERIENCES}
          title="view experiences"
        >
          <BadgeOutlinedIcon data-testid={DATA_TEST_ID.CHAT_HEADER_ICON_EXPERIENCES} />
        </PrimaryIconButton>
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
    </Box>
  );
};

export default ChatHeader;
