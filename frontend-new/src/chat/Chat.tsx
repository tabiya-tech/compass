import React, { useState } from "react";
import { Box } from "@mui/material";
import ChatHeader from "./ChatHeader/ChatHeader";
import ChatMessageField from "./ChatMessageField/ChatMessageField";

const uniqueId = "b7ea1e82-0002-432d-a768-11bdcd186e1d";
export const DATA_TEST_ID = {
  CHAT_CONTAINER: `chat-container-${uniqueId}`,
};

const Chat = () => {
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [messageList, setMessageList] = useState<string[]>([]);

  const handleSend = () => {
    if (currentMessage.trim()) {
      setMessageList((prevMessages) => {
        const newMessages = [...prevMessages, currentMessage];
        console.log(newMessages, "messages");
        console.log(messageList, "newMessages");
        return newMessages;
      });
      setCurrentMessage("");
    }
  };
  return (
    <Box data-testid={DATA_TEST_ID.CHAT_CONTAINER}>
      <ChatHeader />
      <Box
        bgcolor="white"
        padding={(theme) => theme.tabiyaSpacing.lg}
        sx={{ borderRadius: "10px", margin: "auto", display: "flex", flexDirection: "column" }}
        height="100%"
        maxWidth="800px"
      >
        <ChatMessageField handleSend={handleSend} message={currentMessage} notifyChange={setCurrentMessage} />
      </Box>
    </Box>
  );
};

export default Chat;
