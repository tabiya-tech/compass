import React, { useCallback, useEffect, useRef, useState } from "react";
import ChatService from "src/chat/ChatService/ChatService";
import ChatList from "src/chat/ChatList/ChatList";
import { IChatMessage } from "./Chat.types";
import { generateCompassMessage, generateUserMessage } from "./util";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Box, useTheme } from "@mui/material";
import ChatHeader from "./ChatHeader/ChatHeader";
import ChatMessageField from "./ChatMessageField/ChatMessageField";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import { ConversationMessage, ConversationMessageSender } from "./ChatService/ChatService.types";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import ExperiencesDrawer from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import { Experience } from "src/experiences/experiencesDrawer/experienceService/experiences.types";
import ExperienceService from "src/experiences/experiencesDrawer/experienceService/experienceService";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import InactiveBackdrop from "src/theme/Backdrop/InactiveBackdrop";
import ConfirmModalDialog from "src/theme/confirmModalDialog/ConfirmModalDialog";
import authStateService from "src/auth/services/AuthenticationState.service";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import FeedbackForm from "src/feedback/feedbackForm/FeedbackForm";
import { ChatError, SessionError } from "src/error/commonErrors";
import { ChatMessageFooterType } from "./ChatMessage/ChatMessage";

const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // in milliseconds
// Set the interval to check every TIMEOUT/3,
// so in worst case scenario the inactivity backdrop will show after TIMEOUT + TIMEOUT/3 of inactivity
export const CHECK_INACTIVITY_INTERVAL = INACTIVITY_TIMEOUT + INACTIVITY_TIMEOUT / 3;
const uniqueId = "b7ea1e82-0002-432d-a768-11bdcd186e1d";
export const DATA_TEST_ID = {
  CONTAINER: `container-${uniqueId}`,
  CHAT_CONTAINER: `chat-container-${uniqueId}`,
};

interface ChatProps {
  showInactiveSessionAlert?: boolean;
  disableInactivityCheck?: boolean;
}

const Chat: React.FC<ChatProps> = ({ showInactiveSessionAlert = false, disableInactivityCheck = false }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [conversationCompleted, setConversationCompleted] = useState<boolean>(false);
  const [exploredExperiences, setExploredExperiences] = useState<number>(0);
  const [conversationConductedAt, setConversationConductedAt] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [experiences, setExperiences] = React.useState<Experience[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState<boolean>(false);
  const [showBackdrop, setShowBackdrop] = useState(showInactiveSessionAlert);
  const [lastActivityTime, setLastActivityTime] = React.useState<number>(Date.now());
  const [newConversationDialog, setNewConversationDialog] = React.useState<boolean>(false);
  const [exploredExperiencesNotification, setExploredExperiencesNotification] = useState<boolean>(false);
  const [isFeedbackFormOpen, setIsFeedbackFormOpen] = useState<boolean>(false);

  const navigate = useNavigate();

  const initializationRef = useRef(false);

  /**
   * adding a message to the end of the existing messages array
   * @param message
   */
  const addMessage = (message: IChatMessage) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  // Check if the conversation is completed and add a feedback message if it is
  const checkAndAddFeedbackMessage = useCallback((conversationCompleted: boolean) => {
    const userPreferences = userPreferencesStateService.getUserPreferences();
    if (!userPreferences?.sessions.length) {
      console.error(new SessionError("User has no sessions", `user_id: ${userPreferences?.user_id}`));
      return;
    }

    const activeSessionId = userPreferences.sessions[0];
    const hasFeedback = userPreferences.sessions_with_feedback?.includes(activeSessionId);

    if (conversationCompleted && !hasFeedback) {
      addMessage({
        ...generateCompassMessage(
          "We’d love your feedback on this conversation. It’ll only take 5 minutes and will help us improve your experience",
          new Date().toISOString()
        ),
        footerType: ChatMessageFooterType.FEEDBACK_FORM_BUTTON,
      });
    }
  }, []);

  const checkAndAddTypingMessage = useCallback(() => {
    if (isTyping) {
      // Only add typing message if it doesn't already exist
      setMessages((prevMessages) => {
        const hasTypingMessage = prevMessages.some((message) => message.isTypingMessage);
        if (!hasTypingMessage) {
          return [...prevMessages, generateCompassMessage("Typing...", new Date().toISOString(), true)];
        }
        return prevMessages;
      });
    } else {
      // filter out the typing message
      setMessages((prevMessages) => prevMessages.filter((message) => !message.isTypingMessage));
    }
  }, [isTyping]);

  const generateThankYouMessage = () => {
    return generateCompassMessage(
      "Thank you for taking the time to share your valuable feedback. Your input is important to us.",
      new Date().toISOString()
    );
  };

  const handleOpenExperiencesDrawer = useCallback(async () => {
    setIsDrawerOpen(true);
    setIsLoading(true);
    try {
      const userPreferences = userPreferencesStateService.getUserPreferences();
      if (!userPreferences?.sessions.length) {
        throw new Error("User has no sessions");
      }
      const experienceService = ExperienceService.getInstance(userPreferences.sessions[0]);
      const data = await experienceService.getExperiences();
      setExperiences(data);
      setIsLoading(false);
    } catch (error) {
      enqueueSnackbar("Failed to retrieve experiences", { variant: "error" });
      console.error(new ChatError("Failed to retrieve experiences", error as Error));
    }
  }, [enqueueSnackbar]);

  /**
   *  Send a message to compass through the chat service
   *  @param userMessage - the message to send
   *  @param session_id - the session id to use to send the message
   *  @returns void
   */
  const sendMessage = useCallback(
    async (userMessage: string, session_id?: number) => {
      setIsTyping(true);
      const sent_at = new Date().toISOString();

      if (userMessage) {
        // optimistically add the user's message for a more responsive feel
        const message = generateUserMessage(userMessage, sent_at);
        addMessage(message);
      }

      try {
        if (!session_id) {
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
          console.error(new ChatError("Chat service is not initialized"));
          addMessage(
            generateCompassMessage(
              "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
              sent_at
            )
          );
          return;
        }

        const response = await chatService.sendMessage(userMessage);
        setConversationCompleted(response.conversation_completed);
        setConversationConductedAt(response.conversation_conducted_at);

        if (response.experiences_explored > exploredExperiences) {
          setExploredExperiences(response.experiences_explored);
          setExploredExperiencesNotification(true);
        }

        response.messages.forEach((messageItem) =>
          addMessage(generateCompassMessage(messageItem.message, messageItem.sent_at))
        );

        checkAndAddFeedbackMessage(response.conversation_completed);
      } catch (error) {
        console.error(new ChatError("Failed to send message:", error as Error));
        addMessage(
          generateCompassMessage(
            "I'm sorry, Something seems to have gone wrong on my end... Can you repeat that?",
            sent_at
          )
        );
      } finally {
        setIsTyping(false);
      }
    },
    [exploredExperiences, checkAndAddFeedbackMessage]
  );

  /**
   * Log the user out and clear the preferences
   */
  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
    await authenticationService!.logout();
    navigate(routerPaths.LOGIN, { replace: true });
    enqueueSnackbar("Successfully logged out.", { variant: "success" });
    setIsLoggingOut(false);
  }, [enqueueSnackbar, navigate]);

  const initializeChat = useCallback(
    async (session_id?: number) => {
      setIsTyping(true);
      if (!session_id) {
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
        console.error(new ChatError("Chat service is not initialized"));
        addMessage(
          generateCompassMessage(
            "I'm sorry, Something seems to have gone wrong on my end... Can you try again?",
            new Date().toISOString()
          )
        );
        return;
      }

      try {
        const history = await chatService.getChatHistory();

        if (history.experiences_explored > exploredExperiences) {
          setExploredExperiences(history.experiences_explored);
        }

        setConversationCompleted(history.conversation_completed);
        setConversationConductedAt(history.conversation_conducted_at);

        if (history.messages.length) {
          setMessages(
            history.messages.map((message: ConversationMessage) =>
              message.sender === ConversationMessageSender.USER
                ? generateUserMessage(message.message, message.sent_at)
                : generateCompassMessage(message.message, message.sent_at)
            )
          );
        }

        const userPreferences = userPreferencesStateService.getUserPreferences();
        if (userPreferences?.sessions_with_feedback?.includes(session_id)) {
          addMessage(generateThankYouMessage());
        } else {
          checkAndAddFeedbackMessage(history.conversation_completed);
        }

        if (!history.messages.length) {
          await sendMessage("", session_id);
        }
      } catch (e) {
        if (e instanceof ServiceError) {
          writeServiceErrorToLog(e, console.error);
        } else {
          console.error(new ChatError("Failed to initialize chat", e as Error));
        }
        const errorMessage = getUserFriendlyErrorMessage(e as Error);
        enqueueSnackbar(errorMessage, { variant: "error" });
      } finally {
        setIsTyping(false);
      }
    },
    [enqueueSnackbar, sendMessage, exploredExperiences, checkAndAddFeedbackMessage]
  );

  useEffect(() => {
    const userPreferences = userPreferencesStateService.getUserPreferences();
    if (!userPreferences || initializationRef.current) {
      return;
    }
    if (userPreferences.sessions.length) {
      initializeChat(userPreferences.sessions[0]).then(() => (initializationRef.current = true));
    }
  }, [initializeChat]);

  const handleSend = useCallback(async () => {
    if (currentMessage.trim()) {
      setCurrentMessage("");
      const userPreferences = userPreferencesStateService.getUserPreferences();
      if (!userPreferences?.sessions.length) {
        console.error(new SessionError("User has no sessions", `user_id: ${userPreferences?.user_id}`));
        enqueueSnackbar("Failed to send message", { variant: "error" });
        return;
      }
      await sendMessage(currentMessage, userPreferences.sessions[0]);
    }
  }, [currentMessage, sendMessage, enqueueSnackbar]);

  const startNewConversation = useCallback(async () => {
    try {
      setIsTyping(true);
      const user = authStateService.getInstance().getUser();
      if (!user?.id) return;

      const preferencesService = new UserPreferencesService();

      let user_preferences = await preferencesService.getNewSession(user?.id);

      userPreferencesStateService.setUserPreferences(user_preferences);

      enqueueSnackbar("New conversation started", { variant: "success" });

      // Initialize the new conversation with the new session id usually at the top of the sessions array
      await initializeChat(user_preferences.sessions[0]);
    } catch (e) {
      console.error(new ChatError("Failed to start new conversation", e as Error));
    } finally {
      setIsTyping(false);
    }
  }, [initializeChat, enqueueSnackbar]);

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

  // Close backdrop when user interacts with the page
  useEffect(() => {
    if (disableInactivityCheck) return;

    // Reset the timer when the user interacts with the page
    const resetTimer = () => {
      setLastActivityTime(Date.now());
      setShowBackdrop(false);
    };

    const events = ["mousedown", "keydown"];
    events.forEach((event) => document.addEventListener(event, resetTimer));

    return () => events.forEach((event) => document.removeEventListener(event, resetTimer));
  }, [disableInactivityCheck]);

  const handleNewConversationDialogToggle = useCallback((newConversationDialogOpen: boolean) => {
    setNewConversationDialog(newConversationDialogOpen);
  }, []);

  const handleConfirmNewConversation = async () => {
    setMessages([]);
    handleNewConversationDialogToggle(false);
    await startNewConversation();
  };

  const handleFeedbackFormToggle = useCallback((feeedBackFormOpen: boolean) => {
    setIsFeedbackFormOpen(feeedBackFormOpen);
  }, []);

  const handleFeedbackSubmit = () => {
    setMessages((prevMessages) => prevMessages.filter((message) => message.footerType === undefined));
    addMessage(generateThankYouMessage());
  };

  // add a message when the user is typing
  useEffect(() => {
    checkAndAddTypingMessage();
  }, [isTyping, checkAndAddTypingMessage]);

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
            position="relative"
            data-testid={DATA_TEST_ID.CHAT_CONTAINER}
          >
            <Box padding={theme.spacing(theme.tabiyaSpacing.xl)}>
              <ChatHeader
                notifyOnLogout={handleLogout}
                startNewConversation={() => handleNewConversationDialogToggle(true)}
                notifyOnExperiencesDrawerOpen={handleOpenExperiencesDrawer}
                experiencesExplored={exploredExperiences}
                exploredExperiencesNotification={exploredExperiencesNotification}
                setExploredExperiencesNotification={setExploredExperiencesNotification}
              />
            </Box>
            <Box sx={{ flex: 1, overflowY: "auto", paddingX: theme.tabiyaSpacing.lg }}>
              <ChatList messages={messages} notifyOpenFeedbackForm={() => handleFeedbackFormToggle(true)} />
            </Box>
            {showBackdrop && <InactiveBackdrop isShown={showBackdrop} />}
            <Box sx={{ flexShrink: 0, padding: theme.tabiyaSpacing.lg, paddingTop: theme.tabiyaSpacing.xs }}>
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
            conversationConductedAt={conversationConductedAt}
          />
          {newConversationDialog && (
            <ConfirmModalDialog
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
              onCancel={() => handleNewConversationDialogToggle(false)}
              onConfirm={handleConfirmNewConversation}
              cancelButtonText="Cancel"
              confirmButtonText="Yes, I'm sure"
            />
          )}
          <FeedbackForm
            isOpen={isFeedbackFormOpen}
            notifyOnClose={() => handleFeedbackFormToggle(false)}
            onFeedbackSubmit={handleFeedbackSubmit}
          />
        </>
      )}
    </>
  );
};

export default Chat;
