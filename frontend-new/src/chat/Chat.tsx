import React from "react";
import { Box } from "@mui/material";
import ChatHeader from "./ChatHeader/ChatHeader";

const uniqueId = "b7ea1e82-0002-432d-a768-11bdcd186e1d";
export const DATA_TEST_ID = {
  CHAT_CONTAINER: `chat-container-${uniqueId}`,
};

const Chat = () => {
  return (
    <Box data-testid={DATA_TEST_ID.CHAT_CONTAINER}>
      <ChatHeader />
    </Box>
  );
};

export default Chat;
