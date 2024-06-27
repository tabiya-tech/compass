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
  const { enqueueSnackbar } = useSnackbar();
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [initialized, setInitialized] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const chatService = useMemo(() => {
    try {
      return new ChatService();
    } catch (error) {
      console.error("Failed to create chat service:", error);
      return;
    }
  }, []);

  const addMessage = (message: IChatMessage) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const initializeChat = useCallback(async () => {
    try {
      if (!chatService) throw new Error("Chat service is not initialized");
      setIsTyping(true);

      const response = await chatService.sendMessage(START_PROMPT);
      response.conversation_context.all_history.turns.forEach((historyItem: any) => {
        const userMessage =
          historyItem.input.message !== START_PROMPT && generateUserMessage(historyItem.input.message);
        const tabiyaMessage = generateCompassMessage(historyItem.output.message_for_user);
        if (userMessage) addMessage(userMessage);
        addMessage(tabiyaMessage);
      });
    } catch (error) {
      console.error("Failed to initialize chat:", error);
      enqueueSnackbar("Something went wrong... Please try logging in again", { variant: "error" });
    } finally {
      setIsTyping(false);
    }
  }, [chatService, enqueueSnackbar]);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      // optimistically add the user's message for a more responsive feel
      const message = generateUserMessage(userMessage);
      addMessage(message);
      try {
        if (!chatService) throw new Error("Chat service is not initialized");
        setIsTyping(true);
        const response = await chatService.sendMessage(userMessage);
        const botMessage = generateCompassMessage(response.last.message_for_user);
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

  useEffect(() => {
    if (!initialized) {
      initializeChat();
      setInitialized(true);
    }
  }, [initializeChat, initialized]);

  const handleSend = useCallback(async () => {
    if (currentMessage.trim()) {
      setCurrentMessage("");
      await sendMessage(currentMessage);
    }
  }, [currentMessage, sendMessage]);

  return (
    <Box width="100%" height="100%" display="flex" flexDirection="column" data-testid={DATA_TEST_ID.CHAT_CONTAINER}>
      <ChatHeader />
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        <ChatList messages={messages} isTyping={isTyping} />
      </Box>
      <Box sx={{ flexShrink: 0 }}>
        <ChatMessageField handleSend={handleSend} message={currentMessage} notifyChange={setCurrentMessage} />
      </Box>
    </Box>
  );
};

export default Chat;
