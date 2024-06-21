import React, { useState, useEffect, useCallback, useMemo } from "react";
import ChatService from "src/chat/ChatService/ChatService";
import ChatList from "src/chat/ChatList/ChatList";
import { IChatMessage } from "./Chat.types";
import { generateCompassMessage, generateUserMessage } from "./util";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Box } from "@mui/material";
import ChatHeader from "./ChatHeader/ChatHeader";
import ChatMessageField from "./ChatMessageField/ChatMessageField";

const uniqueId = "b7ea1e82-0002-432d-a768-11bdcd186e1d";
export const DATA_TEST_ID = {
  CHAT_CONTAINER: `chat-container-${uniqueId}`,
};

export const START_PROMPT = "~~~START_CONVERSATION~~~";

const Chat = () => {
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [initialized, setInitialized] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const chatService = useMemo(() => new ChatService(), []);

  const { enqueueSnackbar } = useSnackbar();

  const addMessage = (message: IChatMessage) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const initializeChat = useCallback(async () => {
    try {
      setIsTyping(true);
      const response = await chatService.sendMessage(START_PROMPT);
      const initialMessage = generateCompassMessage(response.message_for_user);
      addMessage(initialMessage);
    } catch (error) {
      console.error("Failed to initialize chat:", error);
      //TODO: fix this
      enqueueSnackbar(JSON.stringify(error, null, 2), { variant: "error" });
    } finally {
      setIsTyping(false);
    }
  }, [chatService, enqueueSnackbar]);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      const message = generateUserMessage(userMessage);
      addMessage(message);
      try {
        setIsTyping(true);
        const response = await chatService.sendMessage(userMessage);
        const botMessage = generateCompassMessage(response.message_for_user);
        addMessage(botMessage);
      } catch (error) {
        console.error("Failed to send message:", error);
        addMessage(
          generateCompassMessage("I'm sorry, I'm having trouble connecting to the server. Please try again later.")
        );
      } finally {
        setIsTyping(false);
      }
    },
    [chatService]
  );

  const clearMessages = useCallback(async () => {
    try {
      setIsTyping(true);
      await chatService.clearChat();
      setMessages([]);
    } catch (error) {
      console.error("Failed to clear chat:", error);
      enqueueSnackbar("Failed to clear chat", { variant: "error" });
    } finally {
      setIsTyping(false);
    }
  }, [chatService, enqueueSnackbar]);

  useEffect(() => {
    if (!initialized) {
      initializeChat();
      setInitialized(true);
    }
  }, [initializeChat, initialized]);

  const handleSend = () => {
    if (currentMessage.trim()) {
      setCurrentMessage("");
    }
  };

  return (
    <Box width="100%" height="100%" data-testid={DATA_TEST_ID.CHAT_CONTAINER}>
      <ChatHeader />
      <ChatList messages={messages} sendMessage={sendMessage} clearMessages={clearMessages} isTyping={isTyping} />
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
