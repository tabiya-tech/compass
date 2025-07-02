import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatService from "src/chat/ChatService/ChatService";
import ChatList from "src/chat/chatList/ChatList";
import { IChatMessage } from "src/chat/Chat.types";
import {
  generateCompassMessage,
  generateConversationConclusionMessage,
  generatePleaseRepeatMessage,
  generateSomethingWentWrongMessage,
  generateTypingMessage,
  generateUserMessage,
  parseConversationPhase,
} from "./util";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Box, useTheme } from "@mui/material";
import ChatHeader from "./ChatHeader/ChatHeader";
import ChatMessageField from "./ChatMessageField/ChatMessageField";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ConversationMessage, ConversationMessageSender } from "./ChatService/ChatService.types";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import ExperiencesDrawer from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import { Experience } from "src/experiences/experienceService/experiences.types";
import ExperienceService from "src/experiences/experienceService/experienceService";
import InactiveBackdrop from "src/theme/Backdrop/InactiveBackdrop";
import ConfirmModalDialog from "src/theme/confirmModalDialog/ConfirmModalDialog";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import { ChatError } from "src/error/commonErrors";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { issueNewSession } from "./issueNewSession";
import { ChatProvider } from "src/chat/ChatContext";
import { lazyWithPreload } from "src/utils/preloadableComponent/PreloadableComponent";
import ChatProgressBar from "./chatProgressbar/ChatProgressBar";
import { CurrentPhase, defaultCurrentPhase } from "./chatProgressbar/types";
import { CompassChatMessageProps } from "./chatMessage/compassChatMessage/CompassChatMessage";
import {
  CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE
} from "./chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";

export const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // in milliseconds
// Set the interval to check every TIMEOUT/3,
// so in worst case scenario the inactivity backdrop will show after TIMEOUT + TIMEOUT/3 of inactivity
export const CHECK_INACTIVITY_INTERVAL = INACTIVITY_TIMEOUT + INACTIVITY_TIMEOUT / 3;

export const FEEDBACK_NOTIFICATION_DELAY = 30 * 60 * 1000; // In milliseconds

const uniqueId = "b7ea1e82-0002-432d-a768-11bdcd186e1d";
export const DATA_TEST_ID = {
  CONTAINER: `container-${uniqueId}`,
  CHAT_CONTAINER: `chat-container-${uniqueId}`,
};

export const NOTIFICATION_MESSAGES_TEXT = {
  NEW_CONVERSATION_STARTED: "New conversation started",
  SUCCESSFULLY_LOGGED_OUT: "Successfully logged out",
  FAILED_TO_START_CONVERSATION: "Failed to start new conversation",
};

interface ChatProps {
  showInactiveSessionAlert?: boolean;
  disableInactivityCheck?: boolean;
}

const Chat: React.FC<ChatProps> = ({ showInactiveSessionAlert = false, disableInactivityCheck = false }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [messages, setMessages] = useState<IChatMessage<any>[]>([]);
  const [conversationCompleted, setConversationCompleted] = useState<boolean>(false);
  const [exploredExperiences, setExploredExperiences] = useState<number>(0);
  const [conversationConductedAt, setConversationConductedAt] = useState<string | null>(null);
  const [aiIsTyping, setAiIsTyping] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [experiences, setExperiences] = React.useState<Experience[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState<boolean>(false);
  const [showBackdrop, setShowBackdrop] = useState(showInactiveSessionAlert);
  const [lastActivityTime, setLastActivityTime] = React.useState<number>(Date.now());
  const [newConversationDialog, setNewConversationDialog] = React.useState<boolean>(false);
  const [exploredExperiencesNotification, setExploredExperiencesNotification] = useState<boolean>(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(
    UserPreferencesStateService.getInstance().getActiveSessionId(),
  );
  const [currentUserId] = useState<string | null>(authenticationStateService.getInstance().getUser()?.id ?? null);

  const navigate = useNavigate();

  const initializingRef = useRef(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  const [currentPhase, setCurrentPhase] = useState<CurrentPhase>(defaultCurrentPhase);

  /**
   * --- Utility functions ---
   */

  const addMessage = (message: IChatMessage<any>) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const removeMessage = (messageId: string) => {
    setMessages((prevMessages) => prevMessages.filter(msg => msg.message_id !== messageId));
  };

  // Depending on the typing state, add or remove the typing message from the messages list
  const addOrRemoveTypingMessage = (userIsTyping: boolean) => {
    if (userIsTyping) {
      // Only add typing message if it doesn't already exist
      setMessages((prevMessages) => {
        // check if the last message is a typing message
        const lastMessage = prevMessages[prevMessages.length - 1];
        const hasTypingMessage = lastMessage?.type === CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE;

        if (!hasTypingMessage) {
          return [...prevMessages, generateTypingMessage()];
        }
        return prevMessages;
      });
    } else {
      // filter out the typing message
      setMessages((prevMessages) =>
        prevMessages.filter((message) => !message.type.startsWith('typing-message-')));
    }
  };

  const timeUntilFeedbackNotification : number | null = useMemo(() => {
    // If there are no messages, we can't calculate the time
    if (messages.length === 0) return null;

    // Get timestamp from the first compass message in the conversation
    const firstCompassMessage = (messages.find((message) => message.type.startsWith('compass-message-')) as IChatMessage<CompassChatMessageProps>)
    // If there is no compass message, we can't calculate the time
    if (!firstCompassMessage) return null;

    // Get the timestamp from the compass message
    const firstCompassMessageTimestamp = firstCompassMessage.payload.sent_at;
    // If there is no timestamp, we can't calculate the time
    if (!firstCompassMessageTimestamp) return null;

    const conversationStartTime = new Date(firstCompassMessageTimestamp).getTime();
    const targetTime = conversationStartTime + FEEDBACK_NOTIFICATION_DELAY;
    const currentTime = Date.now();
    return Math.max(0, targetTime - currentTime);
  }, [messages]);

  /**
   * --- Service handlers ---
   */
    // Goes to the experience service to get the experiences
  const fetchExperiences = useCallback(async () => {
    if (!activeSessionId) {
      // If there is no session id, we can't get the experiences
      throw new ChatError("Session id is not available");
    }
    setIsLoading(true);
    try {
      const experienceService = ExperienceService.getInstance();
      const data = await experienceService.getExperiences(activeSessionId);
      setExperiences(data);
    } catch (error) {
      console.error(new ChatError("Failed to retrieve experiences", error));
      enqueueSnackbar("Failed to retrieve experiences", { variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [enqueueSnackbar, activeSessionId]);

  // Opens the experiences drawer and get experiences if needed
  const handleOpenExperiencesDrawer = useCallback(async () => {
    setIsDrawerOpen(true);
    await fetchExperiences();
  }, [fetchExperiences]);

  // Goes to the authentication service to log the user out
  // Navigates to the login page
  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
    await authenticationService!.logout();
    navigate(routerPaths.LANDING, { replace: true });
    enqueueSnackbar(NOTIFICATION_MESSAGES_TEXT.SUCCESSFULLY_LOGGED_OUT, { variant: "success" });
    setIsLoggingOut(false);
  }, [enqueueSnackbar, navigate]);

  // Goes to the chat service to send a message
  const sendMessage = useCallback(
    async (userMessage: string, sessionId: number) => {
      setAiIsTyping(true);
      if (userMessage) {
        // optimistically add the user's message for a more responsive feel
        const message = generateUserMessage(userMessage, new Date().toISOString());
        addMessage(message);
      }

      try {
        // Send the user's message
        const response = await ChatService.getInstance().sendMessage(sessionId, userMessage);

        setExploredExperiences(response.experiences_explored);

        if (response.experiences_explored > exploredExperiences) {
          setExploredExperiencesNotification(true);
        }

        response.messages.forEach((messageItem) => {
          const message = response.conversation_completed && messageItem === response.messages[response.messages.length - 1]
            ? generateConversationConclusionMessage(messageItem.message_id, messageItem.message)
            : generateCompassMessage(messageItem.message_id, messageItem.message, messageItem.sent_at, messageItem.reaction);
          addMessage(message);
        });

        setConversationCompleted(response.conversation_completed);
        setConversationConductedAt(response.conversation_conducted_at);

        // Set the current conversation phase
        setCurrentPhase(_previousCurrentPhase => {
          return parseConversationPhase(response.current_phase, _previousCurrentPhase);
        });
      } catch (error) {
        console.error(new ChatError("Failed to send message:", error));
        addMessage(generatePleaseRepeatMessage());
      } finally {
        setAiIsTyping(false);
      }
    },
    [exploredExperiences],
  );

  const initializeChat = useCallback(
    async (userId: string | null, currentSessionId: number | null) => {
      if (userId === null) {
        // If the user id is not available, then the chat cannot be initialized
        console.error(new ChatError("Chat cannot be initialized, there is not User id  not available"));
        return false;
      }

      setAiIsTyping(true);
      let sessionId: number | null = currentSessionId;

      try {
        if (!sessionId) {
          sessionId = await issueNewSession(userId);
          if (sessionId) {
            // Clear the messages if a new session is issued
            //  and add a typing message as the previous one will be removed
            setMessages([generateTypingMessage()]);
            // AND clear the current phase
            setCurrentPhase(defaultCurrentPhase)
          } else {
            console.debug("Failed to issue new session");
            return false;
          }
        }

        // Get the chat history
        const instance = ChatService.getInstance();
        const history = await instance.getChatHistory(sessionId);

        // Set the messages from the chat history
        if (history.messages.length) {
          setMessages(
            history.messages.map((message: ConversationMessage) => {
              if (message.sender === ConversationMessageSender.USER) {
                return generateUserMessage(message.message, message.sent_at);
              }
              // If this is the last message and conversation is completed, make it a conclusion message
              if (history.conversation_completed && message === history.messages[history.messages.length - 1]) {
                return generateConversationConclusionMessage(message.message_id, message.message);
              }
              return generateCompassMessage(message.message_id, message.message, message.sent_at, message.reaction);
            }),
          );

          setConversationCompleted(history.conversation_completed);
          setConversationConductedAt(history.conversation_conducted_at);
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

        // Set the current conversation phase
        setCurrentPhase(_previousCurrentPhase => {
          return parseConversationPhase(history.current_phase, _previousCurrentPhase);
        })
        return true;
      } catch (e) {
        console.error(new ChatError("Failed to initialize chat", e));
        return false;
      } finally {
        setAiIsTyping(false);
      }
    },
    [sendMessage],
  );

  // Resets the text field for the next message
  // Optimistically adds the user's message to the messages list
  // Calls the sendMessage function to send the message
  const handleSend = useCallback(async (userMessage: string) => {
    await sendMessage(userMessage, activeSessionId!);
  }, [sendMessage, activeSessionId]);

  /**
   * --- Callbacks for child components ---
   */

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  const handleConfirmNewConversation = useCallback(async () => {
    setNewConversationDialog(false);
    setExploredExperiencesNotification(false);
    if (await initializeChat(currentUserId, null)) {
      enqueueSnackbar(NOTIFICATION_MESSAGES_TEXT.NEW_CONVERSATION_STARTED, { variant: "success" });
    } else {
      // Add a message to the chat saying that something went wrong
      setMessages([generateSomethingWentWrongMessage()]);
      // Set the conversation as completed to prevent the user from sending any messages
      setConversationCompleted(true);
      // Notify the user that the chat failed to start
      enqueueSnackbar(NOTIFICATION_MESSAGES_TEXT.FAILED_TO_START_CONVERSATION, { variant: "error" });
    }
  }, [enqueueSnackbar, initializeChat, currentUserId]);

  /**
   * --- UseEffects ---
   */

  // Initialize the chat when the component mounts
  useEffect(() => {
    if (initializingRef.current) {
      return;
    }
    initializingRef.current = true;
    initializeChat(currentUserId, activeSessionId).then((successful: boolean) => {
      if (!successful) {
        // Add a message to the chat saying that something went wrong
        setMessages([generateSomethingWentWrongMessage()]);
        // Set the conversation as completed to prevent the user from sending any messages
        setConversationCompleted(true);
        // Notify the user that the chat failed to start
        enqueueSnackbar(NOTIFICATION_MESSAGES_TEXT.FAILED_TO_START_CONVERSATION, { variant: "error" });
      }
      setInitialized(true);
    });
  }, [enqueueSnackbar, initializeChat, activeSessionId, currentUserId]);

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

  // Preload the "Download Report" button when experiences are explored.
  // The button is loaded lazily, so this is a good opportunity to load it manually.
  // When the user opens the experience drawer, the button should already be available.
  // If the component is not loaded for any reason, the user will have to wait for it.
  useEffect(() => {
    if (exploredExperiencesNotification) {
      console.debug("Preloading DownloadReportDropdown");
      const LazyDownloadReportDropdown = lazyWithPreload(() => import("src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown"));
      LazyDownloadReportDropdown.preload().then(() => {
        console.debug("DownloadReportDropdown preloaded");
      });
    }
  }, [exploredExperiencesNotification]);

  // add a message when the compass is typing
  useEffect(() => {
    addOrRemoveTypingMessage(aiIsTyping);
  }, [aiIsTyping]);

  return (
    <Suspense fallback={<Backdrop isShown={true} transparent={true} />}>
      {isLoggingOut ? (
        <Backdrop isShown={isLoggingOut} message={"Logging you out, wait a moment..."} />
      ) : (
        <ChatProvider
          handleOpenExperiencesDrawer={handleOpenExperiencesDrawer}
          removeMessage={removeMessage}
          addMessage={addMessage}
        >
          <Box
            width="100%"
            height="100%"
            display="flex"
            flexDirection="column"
            position="relative"
            data-testid={DATA_TEST_ID.CHAT_CONTAINER}
            // The "is-initialized" attribute helps make the component testable.
            // When the component mounts, an initialization function runs, changing the state and causing a rerender.
            // Tests need to wait for the component to "settle" after mounting, but they don't know when that happens.
            // To check if the component is settled, tests can wait for the "is-initialized" attribute to be true:
            //   await waitFor(() => {
            //     expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toHaveAttribute("is-initialized", "true");
            //   });
            // This technique can solve the "Warning: An update to Chat inside a test was not wrapped in act(...)" warning.
            is-initialized={`${initialized}`}
          >
            <Box padding={theme.spacing(theme.tabiyaSpacing.lg)}>
              <ChatHeader
                notifyOnLogout={handleLogout}
                startNewConversation={() => setNewConversationDialog(true)}
                experiencesExplored={exploredExperiences}
                exploredExperiencesNotification={exploredExperiencesNotification}
                setExploredExperiencesNotification={setExploredExperiencesNotification}
                conversationCompleted={conversationCompleted}
                timeUntilNotification={timeUntilFeedbackNotification}
                progressPercentage={currentPhase.percentage}
              />
            </Box>
            <Box paddingBottom={theme.spacing(theme.tabiyaSpacing.lg)} paddingX={theme.spacing(theme.tabiyaSpacing.md)}>
              <ChatProgressBar
                percentage={currentPhase.percentage}
                phase={currentPhase.phase}
                current={currentPhase.current}
                total={currentPhase.total}
              />
            </Box>
            <Box sx={{ flex: 1, overflowY: "auto", paddingX: theme.spacing(theme.tabiyaSpacing.lg) }}>
              <ChatList messages={messages} />
            </Box>
            {showBackdrop && <InactiveBackdrop isShown={showBackdrop} />}
            <Box sx={{ flexShrink: 0, padding: theme.tabiyaSpacing.lg, paddingTop: theme.tabiyaSpacing.xs }}>
              <ChatMessageField
                handleSend={handleSend}
                aiIsTyping={aiIsTyping}
                isChatFinished={conversationCompleted}
              />
            </Box>
          </Box>
          <ExperiencesDrawer
            isOpen={isDrawerOpen}
            notifyOnClose={handleDrawerClose}
            isLoading={isLoading}
            experiences={experiences}
            conversationConductedAt={conversationConductedAt}
            onExperiencesUpdated={fetchExperiences}
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
              onDismiss={() => setNewConversationDialog(false)}
              cancelButtonText="Cancel"
              confirmButtonText="Yes, I'm sure"
            />
          )}
        </ChatProvider>
      )}
    </Suspense>
  );
};

export default Chat;
