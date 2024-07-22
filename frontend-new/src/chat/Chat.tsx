import React, { useCallback, useContext, useEffect, useState } from "react";
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
import { AuthContext } from "src/auth/Providers/AuthProvider/AuthProvider";
import { ConversationMessage, ConversationMessageSender } from "./ChatService/ChatService.types";
import { UserPreferencesContext } from "src/auth/Providers/UserPreferencesProvider/UserPreferencesProvider";

const uniqueId = "b7ea1e82-0002-432d-a768-11bdcd186e1d";
export const DATA_TEST_ID = {
  CHAT_CONTAINER: `chat-container-${uniqueId}`,
};

const Chat = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [conversationCompleted, setConversationCompleted] = useState<boolean>(false);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [initialized, setInitialized] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const { userPreferences, updateUserPreferences } = useContext(UserPreferencesContext);
  const { logout } = useContext(AuthContext);

  const navigate = useNavigate();

  const addMessage = (message: IChatMessage) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const sendMessage = useCallback(async (userMessage: string, session_id?: number) => {
    const sent_at = new Date().toISOString(); // Generate current sent_at
    if (userMessage) {
      // optimistically add the user's message for a more responsive feel
      const message = generateUserMessage(userMessage, sent_at);
      addMessage(message);
    }
    try {
      if (!session_id) {
        console.error("User has no sessions");
        addMessage(
          generateCompassMessage(
            "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
            sent_at
          )
        );
        return;
      }
      const chatService = ChatService.getInstance(session_id);
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
      setConversationCompleted(response.conversation_completed);
      const botMessages = response.messages.map((messageItem) =>
        generateCompassMessage(messageItem.message, messageItem.sent_at)
      );
      botMessages.forEach((message) => addMessage(message));
    } catch (error) {
      console.error("Failed to send message:", error);
      addMessage(
        generateCompassMessage("I'm sorry, Something seems to have gone wrong on my end... Can you try again?", sent_at)
      );
    } finally {
      setIsTyping(false);
    }
  }, []);

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

  const initializeChat = useCallback(
    async (session_id?: number) => {
      setMessages([]);

      try {
        if (!session_id) {
          console.error("User has no sessions");
          addMessage(
            generateCompassMessage(
              "I'm sorry, Something seems to have gone wrong on my end... Can you try again?",
              new Date().toISOString()
            )
          );
          return;
        }
        const chatService = ChatService.getInstance(session_id);
        if (!chatService) {
          console.error("Chat service is not initialized");
          addMessage(
            generateCompassMessage(
              "I'm sorry, Something seems to have gone wrong on my end... Can you try again?",
              new Date().toISOString()
            )
          );
          return;
        }
        setIsTyping(true);

        const history = await chatService.getChatHistory();
        if (history.conversation_completed) setConversationCompleted(true);
        if (history.messages.length) {
          history.messages.forEach((message: ConversationMessage) => {
            if (message.sender === ConversationMessageSender.USER && message.message !== "") {
              addMessage(generateUserMessage(message.message, message.sent_at));
            } else {
              addMessage(generateCompassMessage(message.message, message.sent_at));
            }
          });
        } else {
          await sendMessage("", session_id);
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
    },
    [enqueueSnackbar, sendMessage]
  );

  useEffect(() => {
    if (!initialized) {
      initializeChat(userPreferences?.sessions[0]);
      setInitialized(true);
    }
  }, [initializeChat, initialized, userPreferences?.sessions]);

  const handleSend = useCallback(async () => {
    if (currentMessage.trim()) {
      setCurrentMessage("");
      await sendMessage(currentMessage, userPreferences?.sessions[0]);
    }
  }, [currentMessage, sendMessage, userPreferences?.sessions]);

  const startNewConversation = useCallback(async () => {
    try {
      const chatService = ChatService.getInstance(userPreferences?.sessions[0]!);

      let session_id = await chatService.getNewSession();

      updateUserPreferences({
        ...userPreferences!,
        sessions: [session_id, ...(userPreferences?.sessions || [])],
      });

      enqueueSnackbar("New conversation started", { variant: "success" });

      await initializeChat(session_id);
    } catch (e) {
      console.error("Failed to start new conversation", e);
    }
  }, [initializeChat, updateUserPreferences, userPreferences, enqueueSnackbar]);

  return (
    <Box width="100%" height="100%" display="flex" flexDirection="column" data-testid={DATA_TEST_ID.CHAT_CONTAINER}>
      <ChatHeader notifyOnLogout={handleLogout} startNewConversation={startNewConversation} />
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        <ChatList messages={messages} isTyping={isTyping} />
      </Box>
      <Box sx={{ flexShrink: 0 }}>
        <ChatMessageField
          handleSend={handleSend}
          aiIsTyping={isTyping}
          isChatFinished={conversationCompleted}
          message={currentMessage}
          notifyChange={setCurrentMessage}
        />
      </Box>
    </Box>
  );
};

export default Chat;
