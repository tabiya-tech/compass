import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import ChatService from "src/chat/ChatService/ChatService";
import ChatList from "src/chat/ChatList/ChatList";
import { IChatMessage } from "./Chat.types";
import { generateCompassMessage, generateUserMessage } from "./util";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Box } from "@mui/material";
import ChatHeader from "./ChatHeader/ChatHeader";
import ChatMessageField from "./ChatMessageField/ChatMessageField";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/error";
import { writeServiceErrorToLog } from "src/error/logger";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { AuthContext } from "src/auth/AuthProvider";
import { ConversationMessage, ConversationMessageSender } from "./ChatService/ChatService.types";

const uniqueId = "b7ea1e82-0002-432d-a768-11bdcd186e1d";
export const DATA_TEST_ID = {
  CHAT_CONTAINER: `chat-container-${uniqueId}`,
};

const Chat = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [initialized, setInitialized] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const { logout } = useContext(AuthContext);

  const chatService = useMemo(() => {
    try {
      return new ChatService();
    } catch (error) {
      console.error("Failed to create chat service:", error);
      return;
    }
  }, []);

  const navigate = useNavigate();

  const addMessage = (message: IChatMessage) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const sendMessage = useCallback(
    async (userMessage: string) => {
      const sent_at = new Date().toISOString(); // Generate current sent_at
      if (userMessage) {
        // optimistically add the user's message for a more responsive feel
        const message = generateUserMessage(userMessage, sent_at);
        addMessage(message);
      }
      try {
        if (!chatService) {
          console.error("Chat service is not initialized");
          addMessage(
            generateCompassMessage(
              "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
              sent_at
            )
          );
          return;
        }
        setIsTyping(true);
        const response = await chatService.sendMessage(userMessage);
        const botMessages = response.map((messageItem) =>
          generateCompassMessage(messageItem.message, messageItem.sent_at)
        );
        botMessages.forEach((message) => addMessage(message));
      } catch (error) {
        console.error("Failed to send message:", error);
        addMessage(
          generateCompassMessage("I'm sorry, Something seems to have gone wrong. Try logging in again.", sent_at)
        );
      } finally {
        setIsTyping(false);
      }
    },
    [chatService]
  );

  const handleLogout = useCallback(() => {
    logout(
      () => {
        navigate(routerPaths.LOGIN, { replace: true });
        enqueueSnackbar("Successfully logged out.", { variant: "success" });
      },
      (error) => {
        const errorMessage = getUserFriendlyErrorMessage(error);
        enqueueSnackbar(errorMessage, { variant: "error" });
      }
    );
  }, [enqueueSnackbar, navigate, logout]);

  const initializeChat = useCallback(async () => {
    try {
      if (!chatService) {
        console.error("Chat service is not initialized");
        addMessage(
          generateCompassMessage(
            "I'm sorry, Something seems to have gone wrong. Try logging in again.",
            new Date().toISOString()
          )
        );
        return;
      }
      setIsTyping(true);

      const history = await chatService.getChatHistory();
      if (history.length) {
        history.forEach((historyItem: ConversationMessage) => {
          if (historyItem.sender === ConversationMessageSender.USER && historyItem.message !== "") {
            addMessage(generateUserMessage(historyItem.message, historyItem.sent_at));
          } else {
            addMessage(generateCompassMessage(historyItem.message, historyItem.sent_at));
          }
        });
      } else {
        await sendMessage("");
      }
    } catch (e) {
      if (e instanceof ServiceError) {
        writeServiceErrorToLog(e, console.error);
      } else {
        console.error("Failed to initialize chat", e);
      }
      const errorMessage = getUserFriendlyErrorMessage(e as Error);
      enqueueSnackbar(errorMessage, { variant: "error" });
    } finally {
      setIsTyping(false);
    }
  }, [chatService, enqueueSnackbar, sendMessage]);

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
      <ChatHeader notifyOnLogout={handleLogout} />
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
