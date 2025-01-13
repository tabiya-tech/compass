import React, { useCallback, useEffect, useRef, useState } from "react";
import ChatService from "src/chat/ChatService/ChatService";
import ChatList from "src/chat/chatList/ChatList";
import { IChatMessage } from "./Chat.types";
import { generateCompassMessage, generateTypingMessage, generateUserMessage } from "./util";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Box, useTheme } from "@mui/material";
import ChatHeader from "./ChatHeader/ChatHeader";
import ChatMessageField from "./ChatMessageField/ChatMessageField";
import { getUserFriendlyErrorMessage, RestAPIError } from "src/error/restAPIError/RestAPIError";
import { writeRestAPIErrorToLog } from "src/error/restAPIError/logger";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ConversationMessage, ConversationMessageSender } from "./ChatService/ChatService.types";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import ExperiencesDrawer from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import { Experience } from "src/experiences/experiencesDrawer/experienceService/experiences.types";
import ExperienceService from "src/experiences/experiencesDrawer/experienceService/experienceService";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import InactiveBackdrop from "src/theme/Backdrop/InactiveBackdrop";
import ConfirmModalDialog from "src/theme/confirmModalDialog/ConfirmModalDialog";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import FeedbackForm from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";
import { ChatError } from "src/error/commonErrors";
import { ChatMessageType } from "src/chat/Chat.types"
import authenticationStateService from "src/auth/services/AuthenticationState.service";

export const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // in milliseconds
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
  const [activeSessionId, setActiveSessionId] = useState<number | null>(
    UserPreferencesStateService.getInstance().getActiveSessionId()
  );
  const [current_user_id] = useState<string | null>(authenticationStateService.getInstance().getUser()?.id ?? null);
  const [sessionHasFeedback] = useState<boolean>(UserPreferencesStateService.getInstance().activeSessionHasFeedback());

  const navigate = useNavigate();

  const initializationRef = useRef(false);

  /**
   * --- Utility functions ---
   */

  const addMessage = (message: IChatMessage) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const generateThankYouMessage = () => {
    return generateCompassMessage(
      "Thank you for taking the time to share your valuable feedback. Your input is important to us.",
      new Date().toISOString()
    );
  };

  const checkAndAddConversationConclusionMessage = useCallback(() => {
    // Assumes the conversation is completed
    if (sessionHasFeedback) {
      // If the user has already given feedback, adds a thank-you message
      addMessage(generateThankYouMessage());
    } else {
      // If they haven't, asks the user to give feedback
      addMessage({
        ...generateCompassMessage(
          "We’d love your feedback on this conversation. It’ll only take 5 minutes and will help us improve your experience",
          new Date().toISOString()
        ),
        type: ChatMessageType.CONVERSATION_CONCLUSION,
      });
    }
  }, [sessionHasFeedback]);

  // Depending on the typing state, add or remove the typing message from the messages list
  const addOrRemoveTypingMessage = (userIsTyping: boolean) => {
    if (userIsTyping) {
      // Only add typing message if it doesn't already exist
      setMessages((prevMessages) => {
        // check if the last message is a typing message
        const hasTypingMessage = prevMessages[prevMessages.length - 1]?.type === ChatMessageType.TYPING;

        if (!hasTypingMessage) {
          return [...prevMessages, generateTypingMessage(new Date().toISOString())];
        }
        return prevMessages;
      });
    } else {
      // filter out the typing message
      setMessages((prevMessages) => prevMessages.filter((message) => message.type !== ChatMessageType.TYPING));
    }
  };

  // Issue a new session and update the user preferences
  const issueNewSession = useCallback(
    async (user_id: string | null) => {
      try {
        setMessages([]);
        // If there is no session id, then create a new session
        const preferencesService = UserPreferencesService.getInstance();
        // expect that the user_id is not null, if so then let the getNewSession function handle it
        let user_preferences = await preferencesService.getNewSession(user_id!);
        // Notify the application that the preferences have changed,
        // otherwise when the chat is renderer, the parent component will not have the latest session
        UserPreferencesStateService.getInstance().setUserPreferences(user_preferences);
        enqueueSnackbar("New conversation started", { variant: "success" });
        return UserPreferencesStateService.getInstance().getActiveSessionId()!;
      } catch (e) {
        addMessage(
          generateCompassMessage(
            "I'm sorry, Something seems to have gone wrong on my end... Can you please repeat that?",
            new Date().toISOString()
          )
        );
        enqueueSnackbar("Failed to start new conversation", { variant: "error" });
        console.error(new ChatError("Failed to create new session", e as Error));
      }
      return null;
    },
    [enqueueSnackbar]
  );

  /**
   * --- Service handlers ---
   */

  // Opens the experiences drawer
  // Goes to the experience service to get the experiences
  const handleOpenExperiencesDrawer = useCallback(async () => {
    setIsDrawerOpen(true);
    setIsLoading(true);
    if (!activeSessionId) {
      // If there is no session id, we can't get the experiences
      throw new ChatError("Session id is not available");
    }
    try {
      const experienceService = new ExperienceService();
      const data = await experienceService.getExperiences(activeSessionId);
      setExperiences(data);
      setIsLoading(false);
    } catch (error) {
      enqueueSnackbar("Failed to retrieve experiences", { variant: "error" });
      console.error(new ChatError("Failed to retrieve experiences", error as Error));
    }
  }, [enqueueSnackbar, activeSessionId]);

  // Goes to the authentication service to log the user out
  // Navigates to the login page
  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
    await authenticationService!.logout();
    navigate(routerPaths.LOGIN, { replace: true });
    enqueueSnackbar("Successfully logged out.", { variant: "success" });
    setIsLoggingOut(false);
  }, [enqueueSnackbar, navigate]);

  // Goes to the chat service to send a message
  const sendMessage = useCallback(
    async (userMessage: string, session_id: number) => {
      setIsTyping(true);
      const sent_at = new Date().toISOString();

      if (currentMessage) {
        // optimistically add the user's message for a more responsive feel
        const message = generateUserMessage(currentMessage, new Date().toISOString());
        addMessage(message);
      }

      try {
        // Send the user's message
        const chatService = ChatService.getInstance(session_id);
        const response = await chatService.sendMessage(userMessage);

        setExploredExperiences(response.experiences_explored);

        if (response.experiences_explored > exploredExperiences) {
          setExploredExperiencesNotification(true);
        }

        response.messages.forEach((messageItem) =>
          addMessage(generateCompassMessage(messageItem.message, messageItem.sent_at))
        );

        setConversationCompleted(response.conversation_completed);
        setConversationConductedAt(response.conversation_conducted_at);

        if (conversationCompleted) {
          checkAndAddConversationConclusionMessage();
        }
      } catch (error) {
        console.error(new ChatError("Failed to send message:", error as Error));
        addMessage(
          generateCompassMessage(
            "I'm sorry, Something seems to have gone wrong on my end... Can you please repeat that?",
            sent_at
          )
        );
      } finally {
        setIsTyping(false);
      }
    },
    [currentMessage, exploredExperiences, conversationCompleted, checkAndAddConversationConclusionMessage]
  );

  const initializeChat = useCallback(
    async (user_id: string | null, currentSessionId: number | null) => {
      setIsTyping(true);
      let sessionId: number | null = currentSessionId;

      try {
        if (!sessionId) {
          sessionId = await issueNewSession(user_id);
          if (!sessionId) {
            console.debug("Failed to issue new session");
            return false;
          }
        }

        // Get the chat history
        const chatService = ChatService.getInstance(sessionId);
        const history = await chatService.getChatHistory();

        // Set the messages from the chat history
        if (history.messages.length) {
          setMessages(
            history.messages.map((message: ConversationMessage) =>
              message.sender === ConversationMessageSender.USER
                ? generateUserMessage(message.message, message.sent_at)
                : generateCompassMessage(message.message, message.sent_at)
            )
          );

          setConversationCompleted(history.conversation_completed);
          setConversationConductedAt(history.conversation_conducted_at);

          // If the conversation is completed, check if the user has given feedback
          if (history.conversation_completed) {
            checkAndAddConversationConclusionMessage();
          }
        } else {
          // if this is the last promise to resolve, we should not set any state before it is resolved
          // This is the first message to kick off the conversation
          await sendMessage("", sessionId);
        }

        // IMPORTANT: set state only after all promises are resolved

        // Set the explored experiences state
        setExploredExperiences(history.experiences_explored);
        setExploredExperiencesNotification(history.experiences_explored > 0);

        // Set the active session id state
        setActiveSessionId(sessionId);
        return true;
      } catch (e) {
        if (e instanceof RestAPIError) {
          writeRestAPIErrorToLog(e, console.error);
        } else {
          console.error(new ChatError("Failed to initialize chat", e as Error));
        }
        const errorMessage = getUserFriendlyErrorMessage(e as Error);
        enqueueSnackbar(errorMessage, { variant: "error" });

        return false;
      } finally {
        setIsTyping(false);
      }
    },
    [issueNewSession, checkAndAddConversationConclusionMessage, sendMessage, enqueueSnackbar]
  );

  // Resets the text field for the next message
  // Optimistically adds the user's message to the messages list
  // Calls the sendMessage function to send the message
  const handleSend = useCallback(async () => {
    if (currentMessage.trim()) {
      setCurrentMessage("");

      await sendMessage(currentMessage, activeSessionId!);
    }
  }, [currentMessage, sendMessage, activeSessionId]);

  /**
   * --- Callbacks for child components ---
   */

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  const handleConfirmNewConversation = useCallback(async () => {
    try {
      setNewConversationDialog(false);
      setExploredExperiencesNotification(false);
      await initializeChat(current_user_id, null);
    } catch (e) {
      addMessage(
        generateCompassMessage(
          "I'm sorry, Something seems to have gone wrong on my end... Can you try again?",
          new Date().toISOString()
        )
      );
      enqueueSnackbar("Failed to start new conversation", { variant: "error" });
      console.error(new ChatError("Failed to start new conversation", e as Error));
    }
  }, [enqueueSnackbar, initializeChat, current_user_id]);

  const handleFeedbackSubmit = () => {
    setMessages((prevMessages) =>
      prevMessages.filter((message) => message.type !== ChatMessageType.CONVERSATION_CONCLUSION)
    );
    addMessage(generateThankYouMessage());
  };

  /**
   * --- UseEffects ---
   */

  // Initialize the chat when the component mounts
  useEffect(() => {
    if (initializationRef.current) {
      return;
    }
    initializationRef.current = true;
    initializeChat(current_user_id, activeSessionId).then((initialized: boolean) => {
      initializationRef.current = initialized;
    });
  }, [initializeChat, activeSessionId, current_user_id]);

  // show the user backdrop when the user is inactive for INACTIVITY_TIMEOUT
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

  // add a message when the compass is typing
  useEffect(() => {
    addOrRemoveTypingMessage(isTyping);
  }, [isTyping]);

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
                startNewConversation={() => setNewConversationDialog(true)}
                notifyOnExperiencesDrawerOpen={handleOpenExperiencesDrawer}
                experiencesExplored={exploredExperiences}
                exploredExperiencesNotification={exploredExperiencesNotification}
                setExploredExperiencesNotification={setExploredExperiencesNotification}
              />
            </Box>
            <Box sx={{ flex: 1, overflowY: "auto", paddingX: theme.tabiyaSpacing.lg }}>
              <ChatList messages={messages} notifyOnFeedbackFormOpened={() => setIsFeedbackFormOpen(true)} />
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
              onCancel={() => setNewConversationDialog(false)}
              onConfirm={handleConfirmNewConversation}
              cancelButtonText="Cancel"
              confirmButtonText="Yes, I'm sure"
            />
          )}
          <FeedbackForm
            isOpen={isFeedbackFormOpen}
            notifyOnClose={() => setIsFeedbackFormOpen(false)}
            onFeedbackSubmit={handleFeedbackSubmit}
          />
        </>
      )}
    </>
  );
};

export default Chat;
