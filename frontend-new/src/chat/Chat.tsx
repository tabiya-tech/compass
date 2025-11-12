import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatService from "src/chat/ChatService/ChatService";
import MetricsService from "src/metrics/metricsService";
import { EventType } from "src/metrics/types";
import ChatList from "src/chat/chatList/ChatList";
import { IChatMessage } from "src/chat/Chat.types";
import {
  CANCELLABLE_CV_TYPING_CHAT_MESSAGE_TYPE,
  generateCancellableCVTypingMessage,
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
import { ConversationMessage, ConversationMessageSender, ConversationResponse } from "./ChatService/ChatService.types";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import ExperiencesDrawer from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import { DiveInPhase, Experience } from "src/experiences/experienceService/experiences.types";
import ExperienceService from "src/experiences/experienceService/experienceService";
import InactiveBackdrop from "src/theme/Backdrop/InactiveBackdrop";
import ConfirmModalDialog from "src/theme/confirmModalDialog/ConfirmModalDialog";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import { AuthenticationError, ChatError } from "src/error/commonErrors";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { issueNewSession } from "./issueNewSession";
import { ChatProvider } from "src/chat/ChatContext";
import { lazyWithPreload } from "src/utils/preloadableComponent/PreloadableComponent";
import ChatProgressBar from "./chatProgressbar/ChatProgressBar";
import { ConversationPhase, CurrentPhase, defaultCurrentPhase } from "./chatProgressbar/types";
import { CompassChatMessageProps } from "./chatMessage/compassChatMessage/CompassChatMessage";
import { CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE } from "./chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { useSkillsRanking } from "src/features/skillsRanking/hooks/useSkillsRanking";
import cvService from "src/CV/CVService/CVService";
import { useCvBulletsHandler } from "./hooks/useCvBulletsHandler";
import {
  getCvUploadDisplayMessage,
  getUploadErrorMessage,
  startUploadPolling,
  stopUploadPolling,
} from "./cvUploadPolling";
import { getCvUploadErrorMessageFromErrorCode } from "./CVUploadErrorHandling";
import type { UploadStatus } from "./Chat.types";
import { nanoid } from "nanoid";

export const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // in milliseconds
// Set the interval to check every TIMEOUT/3,
// so in worst case scenario the inactivity backdrop will show after TIMEOUT + TIMEOUT/3 of inactivity
export const CHECK_INACTIVITY_INTERVAL = INACTIVITY_TIMEOUT + INACTIVITY_TIMEOUT / 3;

export const FEEDBACK_NOTIFICATION_DELAY = 30 * 60 * 1000; // In milliseconds
// Always add an artificial typing message for the conclusion message
export const TYPING_BEFORE_CONCLUSION_MESSAGE_TIMEOUT = 3000; // In milliseconds
export const MAX_UPLOAD_POLL_MS = 60 * 1000; // Abort polling after 1 minute
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

const createShowConclusionMessage = (
  lastMessage: ConversationMessage,
  addMessageToChat: (message: IChatMessage<any>) => void,
  setAiIsTyping: (isTyping: boolean) => void,
  skipTyping: boolean = false
) => {
  return () => {
    const conclusionMessage = generateConversationConclusionMessage(lastMessage.message_id, lastMessage.message);

    // Skip typing message when skills ranking is already completed
    if (skipTyping) {
      addMessageToChat(conclusionMessage);
    } else {
      setAiIsTyping(true);
      setTimeout(() => {
        setAiIsTyping(false);
        addMessageToChat(conclusionMessage);
      }, TYPING_BEFORE_CONCLUSION_MESSAGE_TIMEOUT);
    }
  };
};

export const Chat: React.FC<Readonly<ChatProps>> = ({
  showInactiveSessionAlert = false,
  disableInactivityCheck = false,
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [messages, setMessages] = useState<IChatMessage<any>[]>([]);
  const [conversationCompleted, setConversationCompleted] = useState<boolean>(false);
  const [exploredExperiences, setExploredExperiences] = useState<number>(0);
  const [conversationConductedAt, setConversationConductedAt] = useState<string | null>(null);
  const [aiIsTyping, setAiIsTyping] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [experiences, setExperiences] = React.useState<Experience[]>([]);
  const [prefillMessage, setPrefillMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState<boolean>(false);
  const [showBackdrop, setShowBackdrop] = useState(showInactiveSessionAlert);
  const [lastActivityTime, setLastActivityTime] = React.useState<number>(Date.now());
  const [newConversationDialog, setNewConversationDialog] = React.useState<boolean>(false);
  const [exploredExperiencesNotification, setExploredExperiencesNotification] = useState<boolean>(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(
    UserPreferencesStateService.getInstance().getActiveSessionId()
  );
  const [currentUserId] = useState<string | null>(authenticationStateService.getInstance().getUser()?.id ?? null);
  const [currentPhase, setCurrentPhase] = useState<CurrentPhase>(defaultCurrentPhase);
  // CV upload states
  const [isUploadingCv, setIsUploadingCv] = useState<boolean>(false);
  const [cvUploadError, setCvUploadError] = useState<string | null>(null);
  const [activeUploads, setActiveUploads] = useState<Map<string, { messageId: string; intervalId: NodeJS.Timeout; timeoutId: NodeJS.Timeout }>>(new Map());

  const navigate = useNavigate();

  const initializingRef = useRef(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Experiences that have been processed
  const exploredExperiencesCount = useMemo(
    () => (experiences ?? []).filter((experience) => experience.exploration_phase === DiveInPhase.PROCESSED),
    [experiences]
  );

  /**
   * --- Utility functions ---
   */

  const addMessageToChat = useCallback((message: IChatMessage<any>) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  }, []);

  const removeMessageFromChat = useCallback((messageId: string) => {
    setMessages((prevMessages) => prevMessages.filter((msg) => msg.message_id !== messageId));
  }, []);

  const { showSkillsRanking } = useSkillsRanking(addMessageToChat, removeMessageFromChat);

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
      setMessages((prevMessages) => prevMessages.filter((message) => !message.type.startsWith("typing-message-")));
    }
  };

  const timeUntilFeedbackNotification: number | null = useMemo(() => {
    // If there are no messages, we can't calculate the time
    if (messages.length === 0) return null;

    // Get timestamp from the first compass message in the conversation
    const firstCompassMessage = messages.find((message) =>
      message.type.startsWith("compass-message-")
    ) as IChatMessage<CompassChatMessageProps>;
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

  // Helper function to process chat history response and update state
  const processChatHistoryResponse = useCallback(
    async (
      response: ConversationResponse,
      options: {
        skipUserMessage?: string; // Skip user messages matching this text (for optimistic updates)
        sessionId: number;
      }
    ) => {
      const { skipUserMessage, sessionId } = options;

      // Update explored experiences
      setExploredExperiences(response.experiences_explored);
      if (response.experiences_explored > exploredExperiences) {
        setExploredExperiencesNotification(true);
        await fetchExperiences();
      }

      // Process messages (skip conclusion message and optionally skip matching user messages)
      // Use functional update to check for existing messages and avoid duplicates
      setMessages((prevMessages) => {
        const existingMessageIds = new Set(prevMessages.map((msg) => msg.message_id));
        const newMessages: IChatMessage<any>[] = [];

        response.messages.forEach((messageItem: ConversationMessage, idx: number) => {
          const isConclusionMessage = response.conversation_completed && idx === response.messages.length - 1;
          if (!isConclusionMessage) {
            // Skip if message already exists
            if (existingMessageIds.has(messageItem.message_id)) {
              return;
            }

            // Skip user messages that match the one we already added optimistically
            if (
              messageItem.sender === ConversationMessageSender.USER &&
              skipUserMessage &&
              messageItem.message === skipUserMessage
            ) {
              return;
            }

            // Add all other messages
            if (messageItem.sender === ConversationMessageSender.USER) {
              newMessages.push(generateUserMessage(messageItem.message, messageItem.sent_at, messageItem.message_id));
            } else {
              newMessages.push(
                generateCompassMessage(
                  messageItem.message_id,
                  messageItem.message,
                  messageItem.sent_at,
                  messageItem.reaction
                )
              );
            }
          }
        });

        return [...prevMessages, ...newMessages];
      });

      // Handle conclusion message and skills ranking flow
      if (response.conversation_completed && response.messages.length) {
        const lastMessage = response.messages[response.messages.length - 1];

        if (SkillsRankingService.getInstance().isSkillsRankingFeatureEnabled()) {
          const skillsRankingState = await SkillsRankingService.getInstance().getSkillsRankingState(sessionId);
          const isAlreadyCompleted = skillsRankingState?.completed_at !== undefined;

          const showConclusionMessage = createShowConclusionMessage(
            lastMessage,
            addMessageToChat,
            setAiIsTyping,
            isAlreadyCompleted
          );
          await showSkillsRanking(showConclusionMessage);
        } else {
          const conclusionMessage = generateConversationConclusionMessage(
            lastMessage.message_id,
            lastMessage.message
          );
          addMessageToChat(conclusionMessage);
        }
      }

      // Update conversation state
      setConversationCompleted(response.conversation_completed);
      setConversationConductedAt(response.conversation_conducted_at);
      setCurrentPhase((_previousCurrentPhase) => parseConversationPhase(response.current_phase, _previousCurrentPhase));
    },
    [exploredExperiences, fetchExperiences, addMessageToChat, showSkillsRanking]
  );

  // Opens the experiences drawer and get experiences if needed
  const handleOpenExperiencesDrawer = useCallback(async () => {
    setIsDrawerOpen(true);
    await fetchExperiences();
  }, [fetchExperiences]);

  // Goes to the authentication service to log the user out
  // Navigates to the login page
  const handleLogout = useCallback(async () => {
    console.debug("Logging out the user.....");
    setIsLoggingOut(true);
    const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
    await authenticationService!.logout();
    navigate(routerPaths.LANDING, { replace: true });
    enqueueSnackbar(NOTIFICATION_MESSAGES_TEXT.SUCCESSFULLY_LOGGED_OUT, { variant: "success" });
    setIsLoggingOut(false);
  }, [enqueueSnackbar, navigate]);

  // Helper to stop polling and cleanup
  const stopPollingForUpload = useCallback((uploadId: string, intervalId?: NodeJS.Timeout, timeoutId?: NodeJS.Timeout) => {
    stopUploadPolling(intervalId && timeoutId ? { intervalId, timeoutId } : undefined);
    setActiveUploads(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(uploadId);
      if (existing) {
        stopUploadPolling({ intervalId: existing.intervalId, timeoutId: existing.timeoutId });
      }
      newMap.delete(uploadId);
      return newMap;
    });
  }, []);

  // Compute display message from status
  const getCvUploadDisplayMessageMemo = useCallback((status: UploadStatus): string => getCvUploadDisplayMessage(status), []);

  // Use the CV bullets handler hook to consolidate upload and reinjection logic
  const cvBulletsHandler = useCvBulletsHandler({
    sessionId: activeSessionId,
    addMessageToChat,
    setAiIsTyping,
    processChatHistoryResponse,
  });

  // Helper function to start polling for upload status
  const startPollingForUpload = useCallback((uploadId: string, messageId: string) => {
    // Stop any existing polling for this uploadId first
    const existing = activeUploads.get(uploadId);
    if (existing) {
      stopPollingForUpload(uploadId, existing.intervalId, existing.timeoutId);
    }

    // Safety timeout to abort stuck polling
    const handles = startUploadPolling({
      uploadId,
      pollIntervalMs: 2000,
      maxDurationMs: MAX_UPLOAD_POLL_MS,
      getStatus: async (id: string): Promise<UploadStatus> => {
        const currentUserId = authenticationStateService.getInstance().getUser()?.id;
        if (!currentUserId) throw new AuthenticationError("User ID missing");
        const resp = await cvService.getInstance().getUploadStatus(currentUserId, id);
        return {
          upload_process_state: resp.upload_process_state,
          cancel_requested: resp.cancel_requested,
          filename: resp.filename,
          user_id: resp.user_id,
          upload_id: resp.upload_id,
          created_at: resp.created_at,
          last_activity_at: resp.last_activity_at,
          error_code: resp.error_code,
          error_detail: resp.error_detail,
          state_injected: resp.state_injected,
          injection_error: resp.injection_error,
          experience_bullets: resp.experience_bullets,
        } as UploadStatus;
      },
      onStatus: (status: UploadStatus | null) => {
        if (!status) return;
        setMessages(prev => prev.map(msg => {
          if (msg.message_id === messageId && msg.type === CANCELLABLE_CV_TYPING_CHAT_MESSAGE_TYPE) {
            return {
              ...msg,
              payload: {
                ...msg.payload,
                message: getCvUploadDisplayMessageMemo(status),
                disabled: status.upload_process_state === "COMPLETED" || status.upload_process_state === "CANCELLED" || status.cancel_requested,
              }
            };
          }
          return msg;
        }));
      },
      onComplete: async (status: UploadStatus) => {
        stopPollingForUpload(uploadId, handles.intervalId as any, handles.timeoutId as any);
        removeMessageFromChat(messageId);
        enqueueSnackbar("CV processed and loaded", { variant: "success" });
        // Frontend metric: auto advance after CV upload completes
        try {
          const userId = authenticationStateService.getInstance().getUser()?.id;
          if (userId && activeSessionId != null) {
            MetricsService.getInstance().sendMetricsEvent({
              event_type: EventType.UI_INTERACTION,
              user_id: userId,
              actions: ["cv_upload_auto_advance"],
              element_id: "cv_upload_auto_advance",
              timestamp: new Date().toISOString(),
              relevant_experiments: {},
              details: {
                session_id: activeSessionId,
                state_injected: Boolean((status as any).state_injected),
              },
            });
          }
        } catch (metricErr) {
          console.error("Failed to send cv_upload_auto_advance metric", metricErr);
        }
        
        // Send experience bullets as a real message if available
        if (status.experience_bullets && status.experience_bullets.length > 0 && activeSessionId != null) {
          try {
            await cvBulletsHandler.handleBullets(status.experience_bullets);
          } catch (err) {
            // Error already logged in handleBullets
          }
        } else {
          // If no bullets, show a message to the user that no experiences were found
          // Keep the typing message visible longer so user can see the "No work experience data found" message
          setTimeout(() => removeMessageFromChat(messageId), 3000);
          enqueueSnackbar("No work experience data found in your CV", { variant: "info" });
          // Don't send the generic message - the state is already injected, just no experiences to display
        }
      },
      onTerminal: (_status: UploadStatus) => {
        stopPollingForUpload(uploadId, handles.intervalId as any, handles.timeoutId as any);
        setTimeout(() => removeMessageFromChat(messageId), 3000);
        // Ensure no stale prefill remains on cancel/fail
        setPrefillMessage(null);
        // Set CV upload error for inline display in ChatMessageField
        const errorMessage = getCvUploadErrorMessageFromErrorCode(_status);
        setCvUploadError(errorMessage);
        // Note: No snackbar here - handleCancelUpload already shows the cancellation message
      },
      onError: (error: unknown) => {
        stopPollingForUpload(uploadId, handles.intervalId as any, handles.timeoutId as any);
        // Ensure no stale prefill remains on errors
        setPrefillMessage(null);
        const err = error as { status?: number; response?: { status?: number; data?: { detail?: string } }; message?: string };
        const statusCode = err?.status || err?.response?.status;
        const detail = err?.response?.data?.detail || err?.message;
        if (statusCode === 404 || err?.message === "timeout") {
          removeMessageFromChat(messageId);
          enqueueSnackbar(getUploadErrorMessage(404, detail), { variant: "warning" });
          return;
        }
        if (statusCode === 409) {
          removeMessageFromChat(messageId);
          enqueueSnackbar(getUploadErrorMessage(409, detail), { variant: "warning" });
          return;
        }
        if (statusCode === 429) {
          enqueueSnackbar(getUploadErrorMessage(429, detail), { variant: "warning" });
        } else if (statusCode) {
          enqueueSnackbar(getUploadErrorMessage(statusCode, detail), { variant: "error" });
        } else {
          enqueueSnackbar("Network error while checking upload status.", { variant: "error" });
        }
        console.error("Error polling upload status:", error);
      },
      isCancelled: () => {
        const currentMessage = messages.find(msg => msg.message_id === messageId);
        return Boolean(currentMessage?.payload.disabled);
      }
    });
    setActiveUploads(prev => new Map(prev).set(uploadId, { messageId, intervalId: handles.intervalId as any, timeoutId: handles.timeoutId as any }));
  }, [activeUploads, stopPollingForUpload, getCvUploadDisplayMessageMemo, removeMessageFromChat, enqueueSnackbar, messages, activeSessionId, cvBulletsHandler]);

  // Helper function to cancel an upload
  const handleCancelUpload = useCallback(async (uploadId: string) => {
    try {
      // If it's the temporary uploadId, just show cancelled state
      if (uploadId === "uploading") {
        setMessages(prev => prev.map(msg => {
          if (msg.type === CANCELLABLE_CV_TYPING_CHAT_MESSAGE_TYPE && !msg.payload.disabled) {
            return {
              ...msg,
              payload: {
                ...msg.payload,
                message: "CV upload cancelled",
                disabled: true,
              }
            };
          }
          return msg;
        }));
        enqueueSnackbar("CV upload cancelled", { variant: "info" });
        return;
      }

      const currentUserId = authenticationStateService.getInstance().getUser()?.id;
      if (!currentUserId) return;

      await cvService.getInstance().cancelUpload(currentUserId, uploadId);

      // Update the message to show cancelled state
      setMessages(prev => prev.map(msg => {
        if (msg.message_id === activeUploads.get(uploadId)?.messageId) {
          return {
            ...msg,
            payload: {
              ...msg.payload,
              message: "CV upload cancelled",
              disabled: true,
            }
          };
        }
        return msg;
      }));

      // Stop polling
      const uploadInfo = activeUploads.get(uploadId);
      if (uploadInfo) {
        stopPollingForUpload(uploadId, uploadInfo.intervalId, uploadInfo.timeoutId);
      }

      enqueueSnackbar("CV upload cancelled", { variant: "info" });
    } catch (error) {
      console.error("Error cancelling upload:", error);
      enqueueSnackbar("Failed to cancel upload", { variant: "error" });
    }
  }, [activeUploads, enqueueSnackbar, stopPollingForUpload]);

  // Handles CV upload
  const handleUploadCv = useCallback(
    async (file: File) => {
      // If already uploading, ignore
      if (isUploadingCv) return [] as string[];

      setIsUploadingCv(true);
      const uploadingMessageId = nanoid();

      try {
        // Clear any previous prefill and CV upload errors to avoid stale text on new uploads
        setPrefillMessage(null);
        setCvUploadError(null);
        enqueueSnackbar(`Uploading ${file.name}...`, { variant: "info" });

        const currentUserId = authenticationStateService.getInstance().getUser()?.id;
        if (!currentUserId) {
          throw new ChatError("User ID is not available");
        }

        // Show the cancellable message immediately
        addMessageToChat({
          ...generateCancellableCVTypingMessage(
            "uploading", // temporary ID until we get the real one
            handleCancelUpload,
            false,
            false,
            "UPLOADING"
          ),
          message_id: uploadingMessageId,
        });

        // Start the upload asynchronously
        const response = await cvService.getInstance().uploadCV(currentUserId, file);

        if (response.uploadId) {
          // Update the message's cancel handler with real id and start polling immediately
          setMessages(prev => prev.map(msg => {
            if (msg.message_id === uploadingMessageId && msg.type === CANCELLABLE_CV_TYPING_CHAT_MESSAGE_TYPE) {
              return {
                ...msg,
                payload: {
                  ...msg.payload,
                  onCancel: async () => await handleCancelUpload(response.uploadId),
                }
              };
            }
            return msg;
          }));
          // Verify the status exists before starting interval polling
          try {
            const currentUserIdVerify = authenticationStateService.getInstance().getUser()?.id;
            if (!currentUserIdVerify) throw new Error("User ID missing");
            await cvService.getInstance().getUploadStatus(currentUserIdVerify, response.uploadId);
            startPollingForUpload(response.uploadId, uploadingMessageId);
          } catch (err: any) {
            const statusCode = err?.status || err?.response?.status;
            const detail = err?.response?.data?.detail || err?.message;
            removeMessageFromChat(uploadingMessageId);
            enqueueSnackbar(getUploadErrorMessage(statusCode, detail), { variant: statusCode && statusCode < 500 ? "warning" : "error" });
            return [] as string[];
          }
        } else {
          // No upload id – treat as immediate failure
          removeMessageFromChat(uploadingMessageId);
          enqueueSnackbar("Failed to start upload.", { variant: "error" });
          return [] as string[];
        }

        return [] as string[];
      } catch (e: any) {
        console.error(e);
        // Ensure we remove the cancellable message on any failure
        removeMessageFromChat(uploadingMessageId);
        // Clear any prefill on failure
        setPrefillMessage(null);
        // Re-throw so ChatMessageField can surface the error inline
        throw e;
      } finally {
        setIsUploadingCv(false);
      }
    },
    [isUploadingCv, enqueueSnackbar, addMessageToChat, handleCancelUpload, startPollingForUpload, removeMessageFromChat]
  );

  // Goes to the chat service to send a message
  const sendMessage = useCallback(
    async (userMessage: string, sessionId: number) => {
      setAiIsTyping(true);
      if (userMessage) {
        // optimistically add the user's message for a more responsive feel
        const message = generateUserMessage(userMessage, new Date().toISOString());
        addMessageToChat(message);
      }

      try {
        // Send the user's message
        const response = await ChatService.getInstance().sendMessage(sessionId, userMessage);
        await processChatHistoryResponse(response, { sessionId });
      } catch (error) {
        console.error(new ChatError("Failed to send message:", error));
        addMessageToChat(generatePleaseRepeatMessage());
      } finally {
        setAiIsTyping(false);
      }
    },
    [addMessageToChat, processChatHistoryResponse]
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
            setCurrentPhase(defaultCurrentPhase);
            // AND clear CV upload errors
            setCvUploadError(null);
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
          // Separate the last message if it's a conclusion
          const isConclusionMessage = history.conversation_completed;
          const mappedMessages = history.messages
            .filter((_, idx) => !(isConclusionMessage && idx === history.messages.length - 1))
            .map((message: ConversationMessage) => {
              if (message.sender === ConversationMessageSender.USER) {
                return generateUserMessage(message.message, message.sent_at);
              }
              return generateCompassMessage(message.message_id, message.message, message.sent_at, message.reaction);
            });

          setMessages(mappedMessages);

          // Handle the conclusion message and skills ranking flow
          if (isConclusionMessage) {
            const lastMessage = history.messages[history.messages.length - 1];

            if (SkillsRankingService.getInstance().isSkillsRankingFeatureEnabled()) {
              // Check if skill ranking is already completed
              const skillsRankingState = await SkillsRankingService.getInstance().getSkillsRankingState(sessionId);
              const isAlreadyCompleted = skillsRankingState?.completed_at !== undefined;

              const showConclusionMessage = createShowConclusionMessage(
                lastMessage,
                addMessageToChat,
                setAiIsTyping,
                isAlreadyCompleted
              );
              await showSkillsRanking(showConclusionMessage);
            } else {
              const conclusionMessage = generateConversationConclusionMessage(
                lastMessage.message_id,
                lastMessage.message
              );
              addMessageToChat(conclusionMessage);
            }
          }

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
        setCurrentPhase((_previousCurrentPhase) => {
          return parseConversationPhase(history.current_phase, _previousCurrentPhase);
        });
        return true;
      } catch (e) {
        console.error(new ChatError("Failed to initialize chat", e));
        return false;
      } finally {
        setAiIsTyping(false);
      }
    },
    [addMessageToChat, setAiIsTyping, showSkillsRanking, sendMessage]
  );

  // Resets the text field for the next message
  // Optimistically adds the user's message to the messages list
  // Calls the sendMessage function to send the message
  const handleSend = useCallback(
    async (userMessage: string) => {
      await sendMessage(userMessage, activeSessionId!);
    },
    [sendMessage, activeSessionId]
  );

  /**
   * --- Callbacks for child components ---
   */

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  const handleConfirmNewConversation = useCallback(async () => {
    setNewConversationDialog(false);
    setExploredExperiencesNotification(false);
    // Clear CV upload errors when starting a new conversation
    setCvUploadError(null);
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
      const LazyDownloadReportDropdown = lazyWithPreload(
        () => import("src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown")
      );
      LazyDownloadReportDropdown.preload().then(() => {
        console.debug("DownloadReportDropdown preloaded");
      });
    }
  }, [exploredExperiencesNotification]);

  // add a message when the compass is typing
  useEffect(() => {
    addOrRemoveTypingMessage(aiIsTyping);
  }, [aiIsTyping]);

  // Fetch experiences when the active session id changes
  // And when not currentPhase is not `INITIALIZING`.
  // We don't want to fetch experiences when the conversation state is partially initialized
  // As fetch experiences will also initialize state thus we face race hazard (concurrency issue)
  useEffect(() => {
    if (activeSessionId && currentPhase.phase !== ConversationPhase.INITIALIZING) {
      fetchExperiences().then();
    }
  }, [activeSessionId, fetchExperiences, currentPhase.phase]);

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      activeUploads.forEach(({ intervalId }) => {
        clearInterval(intervalId);
      });
    };
  }, [activeUploads]);

  return (
    <Suspense fallback={<Backdrop isShown={true} transparent={true} />}>
      {isLoggingOut ? (
        <Backdrop isShown={isLoggingOut} message={"Logging you out, wait a moment..."} />
      ) : (
        <ChatProvider
          handleOpenExperiencesDrawer={handleOpenExperiencesDrawer}
          removeMessageFromChat={removeMessageFromChat}
          addMessageToChat={addMessageToChat}
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
                experiencesExplored={exploredExperiencesCount.length}
                exploredExperiencesNotification={exploredExperiencesNotification}
                setExploredExperiencesNotification={setExploredExperiencesNotification}
                conversationCompleted={conversationCompleted}
                timeUntilNotification={timeUntilFeedbackNotification}
                progressPercentage={currentPhase.percentage}
                conversationPhase={currentPhase.phase}
                collectedExperiences={experiences?.length}
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
                setAiIsTyping={setAiIsTyping}
                isChatFinished={conversationCompleted}
                isUploadingCv={isUploadingCv || activeUploads.size > 0}
                onUploadCv={handleUploadCv}
                currentPhase={currentPhase.phase}
                prefillMessage={prefillMessage}
                cvUploadError={cvUploadError}
                activeSessionId={activeSessionId}
                onCvBulletsSent={cvBulletsHandler.handleBulletsSent}
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
