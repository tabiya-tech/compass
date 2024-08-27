import React, { useCallback, useContext, useEffect, useState } from "react";
import ChatService from "src/chat/ChatService/ChatService";
import ChatList from "src/chat/ChatList/ChatList";
import { IChatMessage } from "./Chat.types";
import { generateCompassMessage, generateUserMessage } from "./util";
import { DEFAULT_SNACKBAR_AUTO_HIDE_DURATION, useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Box, Button, ButtonProps } from "@mui/material";
import ChatHeader from "./ChatHeader/ChatHeader";
import ChatMessageField from "./ChatMessageField/ChatMessageField";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { ConversationMessage, ConversationMessageSender, ConverstaionResponse } from "./ChatService/ChatService.types";
import { UserPreferencesContext } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import ExperiencesDrawer from "src/Experiences/ExperiencesDrawer";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import ExperienceService from "src/Experiences/ExperienceService/ExperienceService";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import InactiveBackdrop from "src/theme/Backdrop/InactiveBackdrop";
import { AuthContext } from "src/auth/AuthProvider";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import { logoutService } from "src/auth/services/logout/logout.service";
import ApproveModal from "src/theme/ApproveModal/ApproveModal";
import { SnackbarKey } from "notistack";

const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // in milliseconds
// Set the interval to check every TIMEOUT/3,
// so in worst case scenario the inactivity backdrop will show after TIMEOUT + TIMEOUT/3 of inactivity
export const CHECK_INACTIVITY_INTERVAL = INACTIVITY_TIMEOUT + INACTIVITY_TIMEOUT / 3;
const uniqueId = "b7ea1e82-0002-432d-a768-11bdcd186e1d";
export const DATA_TEST_ID = {
  CHAT_CONTAINER: `chat-container-${uniqueId}`,
};

interface ChatProps {
  showInactiveSessionAlert?: boolean;
  showNewExperienceAlert?: boolean;
  disableInactivityCheck?: boolean;
}

const ViewExperienceAction: React.FC<Pick<ButtonProps, "onClick">> = (props) => <Button color={"info"} variant={"text"} {...props}>View</Button>

const Chat: React.FC<ChatProps> = ({ showInactiveSessionAlert = false, showNewExperienceAlert = false, disableInactivityCheck = false }) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar()
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [conversationCompleted, setConversationCompleted] = useState<boolean>(false);
  const [exploredExperiences, setExploredExperiences] = useState<number>(0);
  const [conversationCompletedAt, setConversationCompletedAt] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [initialized, setInitialized] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const { userPreferences, updateUserPreferences } = useContext(UserPreferencesContext);
  const { user, clearUser } = useContext(AuthContext);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [experiences, setExperiences] = React.useState<Experience[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState<boolean>(false);
  const [showBackdrop, setShowBackdrop] = useState(showInactiveSessionAlert);
  const [lastActivityTime, setLastActivityTime] = React.useState<number>(Date.now());
  const [newConversationDialog, setNewConversationDialog] = React.useState<boolean>(false);

  const navigate = useNavigate();

  const addMessage = (message: IChatMessage) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const handleOpenExperiencesDrawer = useCallback(async () => {
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
  }, [userPreferences?.sessions, enqueueSnackbar])

  /**
   * Action handler: View experiences drawer
   * This function is called when the user clicks on the view experiences drawer notification button
   * @returns void
   *
   */
  const viewExperiencesDrawerHandler = useCallback((key: SnackbarKey)=> {
    closeSnackbar(key)
    handleOpenExperiencesDrawer().then()
  }, [closeSnackbar, handleOpenExperiencesDrawer])

  const showNewExperienceAlertHandler = useCallback((response: ConverstaionResponse, autoHideDuration = DEFAULT_SNACKBAR_AUTO_HIDE_DURATION) => {
    setExploredExperiences(response.experiences_explored);
    const key = enqueueSnackbar(
      `There is a new experience in your Skills Report.`,
      {
        autoHideDuration,
        variant: "info",
        action: <ViewExperienceAction onClick={() => viewExperiencesDrawerHandler(key)} />
      });
  }, [viewExperiencesDrawerHandler, enqueueSnackbar])

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
      setConversationCompletedAt(response.conversation_completed_at);

      if(response.experiences_explored && response.experiences_explored > exploredExperiences) {
        showNewExperienceAlertHandler(response)
      }

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
  }, [exploredExperiences, showNewExperienceAlertHandler]);

  const handleLogout = useCallback(async () => {
    const successCallback = () => {
      setIsLoggingOut(false);
      // clear the user from the context, and the persistent storage
      clearUser();
      // clear the userPreferences from the context and persistent storage as well
      updateUserPreferences(null);
      navigate(routerPaths.LOGIN, { replace: true });
      enqueueSnackbar("Successfully logged out.", { variant: "success" });
    };
    const failureCallback = (error: FirebaseError) => {
      setIsLoggingOut(false);
      const errorMessage = getUserFriendlyErrorMessage(error);
      enqueueSnackbar(errorMessage, { variant: "error" });
    };
    setIsLoggingOut(true);
    try {
      // Call the logout service to handle the logout based on the current login method
      logoutService.handleLogout(successCallback, failureCallback);
    } catch (error) {
      setIsLoggingOut(false);
      console.error("Failed to logout", error);
      enqueueSnackbar("Failed to logout", { variant: "error" });
    }
  }, [enqueueSnackbar, navigate, clearUser, updateUserPreferences]);

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

        if(history.experiences_explored && history.experiences_explored > exploredExperiences) {
          setExploredExperiences(history.experiences_explored);
        }

        if (history.conversation_completed) setConversationCompleted(true);
        if (history.conversation_completed_at) setConversationCompletedAt(history.conversation_completed_at);
        if (history.messages.length) {
          setMessages([]); // Clear the messages before adding the new ones
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
    [enqueueSnackbar, exploredExperiences, sendMessage]
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

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  // show the user backdrop when the user is inactive for 2 minutes
  useEffect(() => {
    if (disableInactivityCheck || conversationCompleted) return;

    const checkInactivity = () => {
      if (Date.now() - lastActivityTime > INACTIVITY_TIMEOUT) {
        setShowBackdrop(true);
      }
    };
    // Check for inactivity
    const interval = setInterval(checkInactivity, CHECK_INACTIVITY_INTERVAL);

    return () => clearInterval(interval);
  }, [lastActivityTime, disableInactivityCheck, conversationCompleted]);

  useEffect(() => {
    if(showNewExperienceAlert){
      showNewExperienceAlertHandler({
        messages: [],
        experiences_explored: 10,
        conversation_completed: false,
        conversation_completed_at: "",
      }, DEFAULT_SNACKBAR_AUTO_HIDE_DURATION * 1000)
    }
  }, [showNewExperienceAlert, showNewExperienceAlertHandler]);

  // Close backdrop when user interacts with the page
  useEffect(() => {
    if (disableInactivityCheck) return;

    // Reset the timer when the user interacts with the page
    const resetTimer = () => {
      setLastActivityTime(Date.now());
      if (showBackdrop) {
        setShowBackdrop(false);
      }
    };

    const handleUserActivity = () => resetTimer();

    document.addEventListener("mousedown", handleUserActivity);
    document.addEventListener("keydown", handleUserActivity);

    return () => {
      document.removeEventListener("mousedown", handleUserActivity);
      document.removeEventListener("keydown", handleUserActivity);
    };
  }, [showBackdrop, disableInactivityCheck]);

  const handleOpenNewConversationDialog = () => {
    setNewConversationDialog(true);
  };

  const handleCloseNewConversationDialog = () => {
    setNewConversationDialog(false);
  };

  const handleConfirmNewConversation = async () => {
    setNewConversationDialog(false);
    await startNewConversation();
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
              startNewConversation={handleOpenNewConversationDialog}
              notifyOnExperiencesDrawerOpen={handleOpenExperiencesDrawer}
            />
            <Box sx={{ flex: 1, overflowY: "auto" }}>
              <ChatList messages={messages} isTyping={isTyping} />
            </Box>
            {showBackdrop && <InactiveBackdrop isShown={showBackdrop} />}
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
            conversationCompletedAt={conversationCompletedAt}
          />
          {newConversationDialog && (
            <ApproveModal
              isOpen={newConversationDialog}
              title="Start New Conversation?"
              content={
                <>
                  Once you start a new conversation, all messages from the current conversation will be lost forever.
                  <br />
                  <br />
                  Are you sure you want to start a new conversation?
                </>
              }
              onCancel={handleCloseNewConversationDialog}
              onApprove={handleConfirmNewConversation}
              cancelButtonText="Cancel"
              approveButtonText="Yes, I'm sure"
            />
          )}
        </>
      )}
    </>
  );
};

export default Chat;
