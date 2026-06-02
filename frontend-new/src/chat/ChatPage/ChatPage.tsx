import React from "react";
import { Box, useTheme } from "@mui/material";
import ChatView, { type ChatViewProps } from "src/chat/ChatView/ChatView";

const uniqueId = "3f7a1b2c-8d4e-5f6a-9b0c-1d2e3f4a5b6c";

export const DATA_TEST_ID = {
  CHAT_PAGE_CONTAINER: `chat-page-container-${uniqueId}`,
  CHAT_PAGE_CHAT_AREA: `chat-page-chat-area-${uniqueId}`,
  CHAT_PAGE_SIDEBAR: `chat-page-sidebar-${uniqueId}`,
};

export interface ChatPageProps {
  chatViewProps: ChatViewProps;
  aboveChatView?: React.ReactNode;
  belowChatView?: React.ReactNode;
  sidebar?: React.ReactNode;
}

const ChatPage: React.FC<ChatPageProps> = ({ chatViewProps, aboveChatView, belowChatView, sidebar }) => {
  const theme = useTheme();

  return (
    <Box
      data-testid={DATA_TEST_ID.CHAT_PAGE_CONTAINER}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.palette.pageBackground.main,
        overflow: "hidden",
      }}
    >
      {/* ── Centred chat column ─────────────────────────────────────────── */}
      <Box
        data-testid={DATA_TEST_ID.CHAT_PAGE_CHAT_AREA}
        sx={(theme) => ({
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          [theme.breakpoints.up("md")]: {
            maxWidth: "50%",
          },
          marginX: "auto",
        })}
      >
        {aboveChatView}
        <ChatView {...chatViewProps} />
        {belowChatView}
      </Box>

      {/* ── Absolute sidebar ────────────────────────────────────────────── */}
      {sidebar && (
        <Box
          component="aside"
          data-testid={DATA_TEST_ID.CHAT_PAGE_SIDEBAR}
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            width: "100%",
            maxWidth: "min(20rem, 25%)",
            overflowY: "auto",
            flexDirection: "column",
            borderLeft: `1px solid ${theme.palette.divider}`,
            // hide on small screens so the sidebar never overlaps the chat
            display: { xs: "none", md: "flex" },
          }}
        >
          {sidebar}
        </Box>
      )}
    </Box>
  );
};

export default ChatPage;
