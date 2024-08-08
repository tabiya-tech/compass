import React, { useCallback, useContext, useEffect, useState } from "react";
import ChatService from "src/chat/ChatService/ChatService";
import ChatList from "src/chat/ChatList/ChatList";
import { IChatMessage } from "./Chat.types";
import { generateCompassMessage, generateUserMessage } from "./util";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Box } from "@mui/material";
import ChatHeader from "./ChatHeader/ChatHeader";
import ChatMessageField from "./ChatMessageField/ChatMessageField";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { EmailAuthContext } from "src/auth/emailAuth/EmailAuthProvider/EmailAuthProvider";
import { ConversationMessage, ConversationMessageSender } from "./ChatService/ChatService.types";
import { UserPreferencesContext } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import ExperiencesDrawer from "src/Experiences/ExperiencesDrawer";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import ExperienceService from "src/Experiences/ExperienceService/ExperienceService";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";

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
  const { logout, isLoggingOut, user } = useContext(EmailAuthContext);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [experiences, setExperiences] = React.useState<Experience[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

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
        updateUserPreferences(null);
        navigate(routerPaths.LOGIN, { replace: true });
        enqueueSnackbar("Successfully logged out.", { variant: "success" });
      },
      (error) => {
        const errorMessage = getUserFriendlyErrorMessage(error);
        enqueueSnackbar(errorMessage, { variant: "error" });
      }
    );
  }, [enqueueSnackbar, navigate, logout, updateUserPreferences]);

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
    if (!initialized && userPreferences?.sessions?.length) {
      initializeChat(userPreferences?.sessions[0]).then((_prefs) => setInitialized(true));
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
      if (!user?.id) return;

      const preferencesService = new UserPreferencesService();

      let user_preferences = await preferencesService.getNewSession(user?.id);

      updateUserPreferences(user_preferences);

      enqueueSnackbar("New conversation started", { variant: "success" });

      // Initialize the new conversation with the new session id usually at the top of the sessions array
      await initializeChat(user_preferences.sessions[0]);
    } catch (e) {
      console.error("Failed to start new conversation", e);
    }
  }, [initializeChat, updateUserPreferences, enqueueSnackbar, user]);

  const handleOpenExperiencesDrawer = async () => {
    setIsDrawerOpen(true);
    setIsLoading(true);
    try {
      const experienceService = ExperienceService.getInstance(userPreferences?.sessions[0]!);
      const data = await experienceService.getExperiences();
      setExperiences(data);
      setIsLoading(false);
    } catch (error) {
      enqueueSnackbar("Failed to retrieve experiences", { variant: "error" });
      console.error("Failed to retrieve experiences", error);
    }
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  return (
    <>
      {isLoggingOut ? (
        <Backdrop isShown={isLoggingOut} message={"Logging you out, wait a moment..."} />
      ) : (
        <>
          <Box
            width="100%"
            height="100%"
            display="flex"
            flexDirection="column"
            data-testid={DATA_TEST_ID.CHAT_CONTAINER}
          >
            <ChatHeader
              notifyOnLogout={handleLogout}
              startNewConversation={startNewConversation}
              notifyOnExperiencesDrawerOpen={handleOpenExperiencesDrawer}
            />
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
          <ExperiencesDrawer
            isOpen={isDrawerOpen}
            notifyOnClose={handleDrawerClose}
            isLoading={isLoading}
            experiences={experiences}
            conversationCompleted={conversationCompleted}
          />
        </>
      )}
    </>
  );
};

export default Chat;
