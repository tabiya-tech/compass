import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ChatService from "src/chat/ChatService/ChatService";
import { IChatMessage } from "src/chat/Chat.types";
import { BWS_TASK_MESSAGE_TYPE } from "src/chat/chatMessage/bwsTaskMessage/BWSTaskMessage";
import {
  CANCELLABLE_CV_TYPING_CHAT_MESSAGE_TYPE,
  generateBWSTaskMessage,
  generateCancellableCVTypingMessage,
  generateCompassMessage,
  generateConversationConclusionMessage,
  generateSomethingWentWrongMessage,
  generateTypingMessage,
  generateUserMessage,
  parseConversationPhase,
} from "./util";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Box, useTheme } from "@mui/material";
import ChatHeader from "src/chat/ChatHeader/ChatHeader";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ConversationMessage, ConversationMessageSender, ConversationResponse } from "./ChatService/ChatService.types";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import InactiveBackdrop from "src/theme/Backdrop/InactiveBackdrop";
import ConfirmModalDialog from "src/theme/confirmModalDialog/ConfirmModalDialog";
import { ChatError, MetricsError } from "src/error/commonErrors";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { ensureSessionForUser } from "./ensureSession";
import { issueNewSession } from "./issueNewSession";
import { getNewSessionEnabled, getProductName } from "src/envService";
import { useRebuildProfile } from "./RebuildProfileContext";
import { ChatProvider } from "src/chat/ChatContext";
import { lazyWithPreload } from "src/utils/preloadableComponent/PreloadableComponent";
import { ConversationPhase, CurrentPhase, defaultCurrentPhase } from "./chatProgressbar/types";
import { CompassChatMessageProps } from "./chatMessage/compassChatMessage/CompassChatMessage";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { useSkillsRanking } from "src/features/skillsRanking/hooks/useSkillsRanking";
import cvService from "src/CV/CVService/CVService";
import MetricsService from "src/metrics/metricsService";
import { EventType } from "src/metrics/types";
import { getNetworkInformation } from "src/metrics/utils/getNetworkInformation";
import {
  getCvUploadDisplayMessage,
  getUploadErrorMessage,
  startUploadPolling,
  stopUploadPolling,
} from "./cvUploadPolling";
import { getCvUploadErrorMessageFromErrorCode } from "./CVUploadErrorHandling";
import type { UploadStatus } from "./Chat.types";
import { nanoid } from "nanoid";
import { useExperiencesDrawer } from "src/experiences/ExperiencesDrawerProvider";
import ModuleHandoffBanner from "src/home/components/ModuleHandoffBanner/ModuleHandoffBanner";
import { useNextModule } from "src/home/useNextModule";
import ChatPage from "src/chat/ChatPage/ChatPage";
import { enqueueErrorSnackbarWithReference } from "src/theme/SnackbarProvider/enqueueErrorSnackbarWithReference";
import SkillsDiscoverySidebar from "src/home/components/Sidebar/SkillsDiscoverySidebar";

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

// i18n notification message keys (tests/components should resolve via t(<key>))
export const NOTIFICATION_MESSAGES_TEXT = {
  NEW_CONVERSATION_STARTED: "chat.chat.notifications.startConversationSuccess",
  SUCCESSFULLY_LOGGED_OUT: "chat.chat.notifications.logoutSuccess",
  FAILED_TO_START_CONVERSATION: "chat.chat.notifications.startConversationFailed",
} as const;

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
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [messages, setMessages] = useState<IChatMessage<any>[]>([]);
  const [conversationCompleted, setConversationCompleted] = useState<boolean>(false);
  const nextModule = useNextModule("skills_discovery");
  const [exploredExperiences, setExploredExperiences] = useState<number>(0);
  const [aiIsTyping, setAiIsTyping] = useState<boolean>(false);
  const [prefillMessage, setPrefillMessage] = React.useState<string | null>(null);
  const [failedSendDraft, setFailedSendDraft] = useState<string | null>(null);
  const [showBackdrop, setShowBackdrop] = useState(showInactiveSessionAlert);
  const [lastActivityTime, setLastActivityTime] = React.useState<number>(Date.now());
  const [showRefreshConfirmDialog, setShowRefreshConfirmDialog] = React.useState<boolean>(false);
  const [newConversationDialog, setNewConversationDialog] = React.useState<boolean>(false);
  const [exploredExperiencesNotification, setExploredExperiencesNotification] = useState<boolean>(false);
  const newSessionEnabled = getNewSessionEnabled();
  const appName = getProductName();
  const allowRefreshRef = useRef<boolean>(false);
  const networkInfoSentRef = useRef<boolean>(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(
    UserPreferencesStateService.getInstance().getActiveSessionId()
  );
  const [currentUserId] = useState<string | null>(authenticationStateService.getInstance().getUser()?.id ?? null);
  const [currentPhase, setCurrentPhase] = useState<CurrentPhase>(defaultCurrentPhase);
  const [sidebarRefreshToken, setSidebarRefreshToken] = useState(0);
  // CV upload states
  const [isUploadingCv, setIsUploadingCv] = useState<boolean>(false);
  const [cvUploadError, setCvUploadError] = useState<string | null>(null);
  const [activeUploads, setActiveUploads] = useState<
    Map<string, { messageId: string; intervalId: NodeJS.Timeout; timeoutId: NodeJS.Timeout }>
  >(new Map());

  const initializingRef = useRef(false);
  const handleQuickReplyRef = useRef<(label: string) => void>(() => {});
  const [initialized, setInitialized] = useState<boolean>(false);
  // Stable ref for handleBWSSubmit — avoids a circular dep between sendMessage and handleBWSSubmit
  const handleBWSSubmitRef = useRef<((taskId: string, bestWaId: string, worstWaId: string) => Promise<void>) | null>(
    null
  );

  const { experiences, fetchExperiences, openExperiencesDrawer, setConversationConductedAt } = useExperiencesDrawer();
  const { registerRebuildProfile } = useRebuildProfile();

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

  useEffect(() => {
    if (!currentUserId || networkInfoSentRef.current) {
      return;
    }
    try {
      const networkInfo = getNetworkInformation();
      MetricsService.getInstance().sendMetricsEvent({
        event_type: EventType.NETWORK_INFORMATION,
        user_id: currentUserId,
        effective_connection_type: networkInfo.effectiveConnectionType,
        connection_type: networkInfo.connectionType,
      });
      networkInfoSentRef.current = true;
    } catch (error) {
      console.error(new MetricsError("Failed to send network information metrics", error));
    }
  }, [currentUserId]);

  // Depending on the typing state, add or remove the typing message from the messages list
  const addOrRemoveTypingMessage = useCallback(
    (userIsTyping: boolean) => {
      if (userIsTyping) {
        // Only add typing message if it doesn't already exist
        const thinkingMessage =
          currentPhase.phase === ConversationPhase.PREFERENCE_ELICITATION
            ? t("chat.chatMessage.typingChatMessage.thinkingPreferenceElicitation")
            : undefined;
        setMessages((prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          const hasTypingMessage = lastMessage?.type?.startsWith("typing-message-") ?? false;

          if (!hasTypingMessage) {
            return [...prevMessages, generateTypingMessage(undefined, thinkingMessage)];
          }
          return prevMessages;
        });
      } else {
        // filter out the typing message
        setMessages((prevMessages) => prevMessages.filter((message) => !message.type.startsWith("typing-message-")));
      }
    },
    [currentPhase.phase, t]
  );

  const recordChatResponseMetrics = useCallback(
    ({
      sessionId,
      userMessage,
      response,
      durationMs,
      previousExploredExperiences,
    }: {
      sessionId: number;
      userMessage: string;
      response: ConversationResponse;
      durationMs: number;
      previousExploredExperiences: number;
    }) => {
      if (!currentUserId) {
        console.error(new MetricsError("Unable to send chat timing metrics: user id is missing"));
        return;
      }

      try {
        const networkInfo = getNetworkInformation();
        MetricsService.getInstance().sendMetricsEvent({
          event_type: EventType.UI_INTERACTION,
          user_id: currentUserId,
          actions: ["chat_response_time"],
          element_id: "chat-send-message",
          timestamp: new Date().toISOString(),
          relevant_experiments: {},
          details: {
            duration_ms: durationMs,
            session_id: sessionId,
            message_length: userMessage.length,
            response_messages: response.messages.length,
            conversation_completed: response.conversation_completed,
            conversation_phase: response.current_phase?.phase,
            conversation_phase_percent: response.current_phase?.percentage,
            experiences_explored: response.experiences_explored,
            experiences_explored_delta: response.experiences_explored - previousExploredExperiences,
            network_effective_type: networkInfo.effectiveConnectionType,
            network_connection_type: networkInfo.connectionType,
            network_rtt_ms: networkInfo.rtt,
            network_downlink_mbps: networkInfo.downlink,
            network_save_data: networkInfo.saveData,
          },
        });
      } catch (error) {
        console.error(new MetricsError("Unable to send chat timing metrics", error));
      }
    },
    [currentUserId]
  );

  const isAwaitingBWSResponse = useMemo(() => {
    if (messages.length === 0) return false;
    return messages[messages.length - 1].type === BWS_TASK_MESSAGE_TYPE;
  }, [messages]);

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
  // Helper to stop polling and cleanup
  const stopPollingForUpload = useCallback(
    (uploadId: string, intervalId?: NodeJS.Timeout, timeoutId?: NodeJS.Timeout) => {
      stopUploadPolling(intervalId && timeoutId ? { intervalId, timeoutId } : undefined);
      setActiveUploads((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(uploadId);
        if (existing) {
          stopUploadPolling({ intervalId: existing.intervalId, timeoutId: existing.timeoutId });
        }
        newMap.delete(uploadId);
        return newMap;
      });
    },
    []
  );

  // Compute display message from status
  const getCvUploadDisplayMessageMemo = useCallback(
    (status: UploadStatus): string => getCvUploadDisplayMessage(status),
    []
  );

  // Helper function to start polling for upload status
  const startPollingForUpload = useCallback(
    (uploadId: string, messageId: string) => {
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
          if (!currentUserId) throw new Error("User ID missing");
          const resp = await cvService.getInstance().getUploadStatus(currentUserId, id);
          // Narrow to UploadStatus
          return {
            upload_process_state: resp.upload_process_state as UploadStatus["upload_process_state"],
            cancel_requested: resp.cancel_requested,
            filename: resp.filename,
            user_id: resp.user_id,
            upload_id: resp.upload_id,
            created_at: resp.created_at,
            last_activity_at: resp.last_activity_at,
            error_code: resp.error_code,
            error_detail: resp.error_detail,
            experience_bullets: resp.experience_bullets,
          } as UploadStatus;
        },
        onStatus: (status: UploadStatus | null) => {
          if (!status) return;
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.message_id === messageId && msg.type === CANCELLABLE_CV_TYPING_CHAT_MESSAGE_TYPE) {
                return {
                  ...msg,
                  payload: {
                    ...msg.payload,
                    message: getCvUploadDisplayMessageMemo(status),
                    disabled:
                      status.upload_process_state === "COMPLETED" ||
                      status.upload_process_state === "CANCELLED" ||
                      status.cancel_requested,
                  },
                };
              }
              return msg;
            })
          );
        },
        onComplete: (status: UploadStatus) => {
          stopPollingForUpload(uploadId, handles.intervalId as any, handles.timeoutId as any);
          removeMessageFromChat(messageId);
          const items: string[] | undefined = status.experience_bullets ?? undefined;
          if (Array.isArray(items) && items.length > 0) {
            const intro = t("chat.util.messages.experiencesIntro");
            const bullets = items
              .map((s) => (s?.trim()?.length ? `• ${s.trim()}` : ""))
              .filter(Boolean)
              .join("\n");
            const composed = bullets ? `${intro}\n${bullets}` : intro;
            setPrefillMessage(composed);
          }
          enqueueSnackbar(t("chat.cvUploadPolling.uploadedSuccessfully"), { variant: "success" });
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
          const err = error as {
            status?: number;
            response?: { status?: number; data?: { detail?: string } };
            message?: string;
          };
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
            enqueueErrorSnackbarWithReference(getUploadErrorMessage(statusCode, detail), {
              where: "CV upload (polling)",
              error,
            });
          } else {
            enqueueErrorSnackbarWithReference(t("chat.cvUploadPolling.networkErrorStatus"), {
              where: "CV upload (polling)",
              error,
            });
          }
          console.error("Error polling upload status:", error);
        },
        isCancelled: () => {
          const currentMessage = messages.find((msg) => msg.message_id === messageId);
          return Boolean(currentMessage?.payload.disabled);
        },
      });
      setActiveUploads((prev) =>
        new Map(prev).set(uploadId, {
          messageId,
          intervalId: handles.intervalId as any,
          timeoutId: handles.timeoutId as any,
        })
      );
    },
    [
      activeUploads,
      enqueueSnackbar,
      removeMessageFromChat,
      messages,
      stopPollingForUpload,
      getCvUploadDisplayMessageMemo,
      t,
    ]
  );

  // Helper function to cancel an upload
  const handleCancelUpload = useCallback(
    async (uploadId: string) => {
      try {
        // If it's the temporary uploadId, just show cancelled state
        if (uploadId === "chat.chatMessageField.placeholders.uploading") {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.type === CANCELLABLE_CV_TYPING_CHAT_MESSAGE_TYPE && !msg.payload.disabled) {
                return {
                  ...msg,
                  payload: {
                    ...msg.payload,
                    message: t("chat.cvUploadPolling.cancelled"),
                    disabled: true,
                  },
                };
              }
              return msg;
            })
          );
          enqueueSnackbar(t("chat.cvUploadPolling.cancelled"), { variant: "info" });
          return;
        }

        const currentUserId = authenticationStateService.getInstance().getUser()?.id;
        if (!currentUserId) return;

        await cvService.getInstance().cancelUpload(currentUserId, uploadId);

        // Update the message to show cancelled state
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.message_id === activeUploads.get(uploadId)?.messageId) {
              return {
                ...msg,
                payload: {
                  ...msg.payload,
                  message: t("chat.cvUploadPolling.cancelled"),
                  disabled: true,
                },
              };
            }
            return msg;
          })
        );

        // Stop polling
        const uploadInfo = activeUploads.get(uploadId);
        if (uploadInfo) {
          stopPollingForUpload(uploadId, uploadInfo.intervalId, uploadInfo.timeoutId);
        }

        enqueueSnackbar(t("chat.cvUploadPolling.cancelled"), { variant: "info" });
      } catch (error) {
        console.error("Error cancelling upload:", error);
        enqueueErrorSnackbarWithReference(t("chat.cvUploadPolling.failedToCancel"), {
          where: "CV upload (cancel)",
          error,
        });
      }
    },
    [activeUploads, enqueueSnackbar, stopPollingForUpload, t]
  );

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
        enqueueSnackbar(t("chat.cvUploadPolling.uploadingFileNamed", { filename: file.name }), { variant: "info" });

        const currentUserId = authenticationStateService.getInstance().getUser()?.id;
        if (!currentUserId) {
          throw new ChatError("User ID is not available");
        }

        // Show the cancellable message immediately
        addMessageToChat({
          ...generateCancellableCVTypingMessage(
            "chat.chatMessageField.placeholders.uploading", // temporary ID until we get the real one
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
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.message_id === uploadingMessageId && msg.type === CANCELLABLE_CV_TYPING_CHAT_MESSAGE_TYPE) {
                return {
                  ...msg,
                  payload: {
                    ...msg.payload,
                    onCancel: async () => await handleCancelUpload(response.uploadId!),
                  },
                };
              }
              return msg;
            })
          );
          // Verify the status exists before starting interval polling
          try {
            const currentUserIdVerify = authenticationStateService.getInstance().getUser()?.id;
            if (!currentUserIdVerify) throw new Error("User ID missing");
            await cvService.getInstance().getUploadStatus(currentUserIdVerify, response.uploadId);
            startPollingForUpload(response.uploadId, uploadingMessageId);
          } catch (err: any) {
            console.error("Failed to verify upload status", err);
            const statusCode = err?.status || err?.response?.status;
            const detail = err?.response?.data?.detail || err?.message;
            removeMessageFromChat(uploadingMessageId);
            enqueueSnackbar(getUploadErrorMessage(statusCode, detail), {
              variant: statusCode && statusCode < 500 ? "warning" : "error",
            });
            return [] as string[];
          }
        } else {
          // No upload id – treat as immediate failure
          removeMessageFromChat(uploadingMessageId);
          console.log("Failed to start upload. Backend did not return uploadId ", response);
          enqueueErrorSnackbarWithReference(t("chat.cvUploadPolling.failedToStart"), {
            where: "CV upload (start)",
            error: new Error("Backend did not return an uploadId"),
          });
          return [] as string[];
        }

        return [] as string[];
      } catch (e: any) {
        console.error(new ChatError("CV upload failed", e));
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
    [
      isUploadingCv,
      enqueueSnackbar,
      addMessageToChat,
      handleCancelUpload,
      startPollingForUpload,
      removeMessageFromChat,
      t,
    ]
  );

  // Stable callback for quick-reply buttons — avoids stale closures in stored message payloads
  const handleQuickReply = useCallback((label: string) => {
    handleQuickReplyRef.current(label);
  }, []);

  // Goes to the chat service to send a message
  const sendMessage = useCallback(
    async (userMessage: string, sessionId: number, displayMessage?: string) => {
      setAiIsTyping(true);
      // Clear quick-reply buttons from all messages when user sends a new message
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.payload?.quick_reply_options) {
            return { ...msg, payload: { ...msg.payload, quick_reply_options: null } };
          }
          return msg;
        })
      );
      // displayMessage="" suppresses the bubble; undefined = use userMessage as display
      const chatText = displayMessage !== undefined ? displayMessage : userMessage;
      let optimisticMessageId: string | undefined;
      if (chatText) {
        optimisticMessageId = nanoid();
        const message = generateUserMessage(
          chatText,
          new Date().toISOString(),
          theme.palette.secondary.main,
          optimisticMessageId
        );
        addMessageToChat(message);
      }

      const startTimeMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      const previousExploredExperiences = exploredExperiences;

      try {
        // Send the user's message
        setFailedSendDraft(null);
        const response = await ChatService.getInstance().sendMessage(sessionId, userMessage);
        const endTimeMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        const durationMs = Math.round(endTimeMs - startTimeMs);
        recordChatResponseMetrics({
          sessionId,
          userMessage,
          response,
          durationMs,
          previousExploredExperiences,
        });

        setExploredExperiences(response.experiences_explored);

        if (response.experiences_explored > exploredExperiences) {
          setExploredExperiencesNotification(true);
          await fetchExperiences();
        }

        response.messages.forEach((messageItem, idx) => {
          const isConclusionMessage = response.conversation_completed && idx === response.messages.length - 1;
          if (!isConclusionMessage) {
            const isLastMessage = idx === response.messages.length - 1;
            if (messageItem.message_type === "BWS_TASK" && messageItem.metadata) {
              if (messageItem.metadata.task_number === 1) {
                addMessageToChat(
                  generateCompassMessage(
                    `bws-transition-${messageItem.message_id}`,
                    t("chat.chat.bwsTransitionMessage"),
                    messageItem.sent_at,
                    null
                  )
                );
              }
              addMessageToChat(
                generateBWSTaskMessage(
                  messageItem.message_id,
                  messageItem.metadata,
                  (t, b, w) => handleBWSSubmitRef.current?.(t, b, w) ?? Promise.resolve()
                )
              );
            } else {
              addMessageToChat(
                generateCompassMessage(
                  messageItem.message_id,
                  messageItem.message,
                  messageItem.sent_at,
                  messageItem.reaction,
                  isLastMessage ? messageItem.quick_reply_options : null,
                  isLastMessage && messageItem.quick_reply_options ? handleQuickReply : undefined
                )
              );
            }
          }
        });
        // Handle the conclusion message and skills ranking flow for new messages
        if (response.conversation_completed && response.messages.length) {
          const lastMessage = response.messages[response.messages.length - 1];

          if (SkillsRankingService.getInstance().isSkillsRankingFeatureEnabled()) {
            // Check if skill ranking is already completed
            const skillsRankingState = await SkillsRankingService.getInstance().getSkillsRankingState(activeSessionId!);
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

        setConversationCompleted(response.conversation_completed);
        setConversationConductedAt(response.conversation_conducted_at);
        setSidebarRefreshToken((t) => t + 1);

        // Set the current conversation phase
        setCurrentPhase((_previousCurrentPhase) => {
          return parseConversationPhase(response.current_phase, _previousCurrentPhase);
        });
      } catch (error) {
        console.error(new ChatError("Failed to send message:", error));
        if (optimisticMessageId) {
          removeMessageFromChat(optimisticMessageId);
        }
        if (chatText) {
          setFailedSendDraft(chatText);
        }
        enqueueErrorSnackbarWithReference(t("common.errors.api.unexpectedError"), {
          where: "Chat conversation (send)",
          error: error as Error,
        });
      } finally {
        setAiIsTyping(false);
      }
    },
    [
      t,
      theme,
      addMessageToChat,
      removeMessageFromChat,
      exploredExperiences,
      fetchExperiences,
      activeSessionId,
      showSkillsRanking,
      recordChatResponseMetrics,
      handleQuickReply,
      setConversationConductedAt,
    ]
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
          if (newSessionEnabled) {
            sessionId = await issueNewSession(userId);
          } else {
            sessionId = await ensureSessionForUser(userId);
          }
          if (sessionId) {
            // Clear the messages if a new session is issued
            //  and add a typing message as the previous one will be removed
            setMessages([generateTypingMessage()]);
            // AND clear the current phase
            setCurrentPhase(defaultCurrentPhase);
          } else {
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
          const filteredMessages = history.messages.filter(
            (_, idx) => !(isConclusionMessage && idx === history.messages.length - 1)
          );
          const mappedMessages = filteredMessages.flatMap(
            (message: ConversationMessage, idx: number, arr: ConversationMessage[]): IChatMessage<any>[] => {
              if (message.sender === ConversationMessageSender.USER) {
                try {
                  const parsed = JSON.parse(message.message);
                  if (parsed.type === "bws_response") return [];
                } catch {}
                return [generateUserMessage(message.message, message.sent_at, theme.palette.secondary.main)];
              }
              const isLast = idx === arr.length - 1;
              if (message.message_type === "BWS_TASK" && message.metadata) {
                const bwsMessage = generateBWSTaskMessage(
                  message.message_id,
                  message.metadata,
                  (t, b, w) => handleBWSSubmitRef.current?.(t, b, w) ?? Promise.resolve()
                );
                if (message.metadata.task_number === 1) {
                  return [
                    generateCompassMessage(
                      `bws-transition-${message.message_id}`,
                      t("chat.chat.bwsTransitionMessage"),
                      message.sent_at,
                      null
                    ),
                    bwsMessage,
                  ];
                }
                return [bwsMessage];
              }
              return [
                generateCompassMessage(
                  message.message_id,
                  message.message,
                  message.sent_at,
                  message.reaction,
                  isLast && !history.conversation_completed ? message.quick_reply_options : null,
                  isLast && !history.conversation_completed && message.quick_reply_options
                    ? handleQuickReply
                    : undefined
                ),
              ];
            }
          );

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
    [
      addMessageToChat,
      setAiIsTyping,
      showSkillsRanking,
      sendMessage,
      handleQuickReply,
      setConversationConductedAt,
      theme,
      newSessionEnabled,
      t,
    ]
  );

  const handleConfirmNewConversation = useCallback(async () => {
    setNewConversationDialog(false);
    setExploredExperiencesNotification(false);
    if (await initializeChat(currentUserId, null)) {
      enqueueSnackbar(t("chat.chat.notifications.startConversationSuccess"), { variant: "success" });
    } else {
      // Add a message to the chat saying that something went wrong
      setMessages([generateSomethingWentWrongMessage()]);
      // Set the conversation as completed to prevent the user from sending any messages
      setConversationCompleted(true);
      // Notify the user that the chat failed to start
      enqueueSnackbar(t("chat.chat.notifications.startConversationFailed"), { variant: "error" });
    }
  }, [
    enqueueSnackbar,
    initializeChat,
    currentUserId,
    t,
    setMessages,
    setConversationCompleted,
    setNewConversationDialog,
    setExploredExperiencesNotification,
  ]);

  // Register/unregister the rebuild profile callback so NavBar can trigger it
  useEffect(() => {
    if (newSessionEnabled) {
      registerRebuildProfile(() => setNewConversationDialog(true));
      return () => registerRebuildProfile(null);
    }
  }, [newSessionEnabled, registerRebuildProfile]);

  // Resets the text field for the next message
  // Optimistically adds the user's message to the messages list
  // Calls the sendMessage function to send the message
  const handleSend = useCallback(
    async (userMessage: string) => {
      await sendMessage(userMessage, activeSessionId!);
    },
    [sendMessage, activeSessionId]
  );

  // Handles BWS task card submission — encodes the selection as JSON and sends via the normal message path
  const handleBWSSubmit = useCallback(
    async (taskId: string, bestWaId: string, worstWaId: string) => {
      const payload = JSON.stringify({ type: "bws_response", task_id: taskId, best: bestWaId, worst: worstWaId });
      // Pass "" as displayMessage to suppress the raw JSON from appearing in the chat
      await sendMessage(payload, activeSessionId!, "");
    },
    [sendMessage, activeSessionId]
  );
  handleBWSSubmitRef.current = handleBWSSubmit;

  // Keep the quick-reply ref pointing at the latest handleSend
  useEffect(() => {
    handleQuickReplyRef.current = handleSend;
  }, [handleSend]);

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
        setMessages([generateSomethingWentWrongMessage()]);
        setConversationCompleted(true);
        enqueueErrorSnackbarWithReference(t("chat.chat.notifications.startConversationFailed"), {
          where: "Chat conversation (start)",
          error: new Error("initializeChat returned false"),
        });
      }
      setInitialized(true);
    });
  }, [enqueueSnackbar, initializeChat, activeSessionId, currentUserId, t]);

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
  }, [aiIsTyping, addOrRemoveTypingMessage]);

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

  // Handle page refresh confirmation when Compass is typing
  useEffect(() => {
    if (!aiIsTyping) {
      allowRefreshRef.current = false;
      return;
    }

    allowRefreshRef.current = false;

    // Intercept keyboard shortcuts for refresh (Ctrl+R, F5, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for refresh shortcuts: F5, Ctrl+R, Ctrl+Shift+R
      if (
        !allowRefreshRef.current &&
        (e.key === "F5" ||
          (e.key === "r" && (e.ctrlKey || e.metaKey)) ||
          (e.key === "R" && (e.ctrlKey || e.metaKey) && e.shiftKey))
      ) {
        e.preventDefault();
        e.stopPropagation();
        setShowRefreshConfirmDialog(true);
      }
    };

    // Handle browser refresh button and navigation attempts
    // beforeunload can only show browser's default dialog due to security restrictions.
    // We show our custom dialog for keyboard shortcuts, and browser's default for reload button.
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!allowRefreshRef.current) {
        // Modern approach: call preventDefault() to trigger the dialog
        // returnValue is deprecated but the docs say to set it for legacy support
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      allowRefreshRef.current = false;
    };
  }, [aiIsTyping]);

  const handleConfirmRefresh = () => {
    allowRefreshRef.current = true;
    setShowRefreshConfirmDialog(false);
    // Use setTimeout to ensure state updates are processed before reload
    setTimeout(() => {
      window.location.reload();
    }, 0);
  };

  const handleCancelRefresh = () => {
    setShowRefreshConfirmDialog(false);
  };

  // Extract quick_reply_options from the last agent message (if any)
  const quickReplyOptions = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.payload?.quick_reply_options || null;
  }, [messages]);

  return (
    <Suspense fallback={<Backdrop isShown={true} transparent={true} />}>
      <ChatProvider
        handleOpenExperiencesDrawer={openExperiencesDrawer}
        removeMessageFromChat={removeMessageFromChat}
        addMessageToChat={addMessageToChat}
      >
        {/* The "is-initialized" attribute helps make the component testable.
            When the component mounts, an initialization function runs, changing the state and causing a rerender.
            Tests need to wait for the component to "settle" after mounting, but they don't know when that happens.
            To check if the component is settled, tests can wait for the "is-initialized" attribute to be true:
              await waitFor(() => {
                expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toHaveAttribute("is-initialized", "true");
              });
            This technique can solve the "Warning: An update to Chat inside a test was not wrapped in act(...)" warning. */}
        <Box
          data-testid={DATA_TEST_ID.CHAT_CONTAINER}
          is-initialized={`${initialized}`}
          sx={{ width: "100%", height: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          <ChatPage
            aboveChatView={
              <ChatHeader
                experiencesExplored={exploredExperiencesCount.length}
                exploredExperiencesNotification={exploredExperiencesNotification}
                setExploredExperiencesNotification={setExploredExperiencesNotification}
                conversationCompleted={conversationCompleted}
                timeUntilNotification={timeUntilFeedbackNotification}
                progressPercentage={currentPhase.percentage}
              />
            }
            chatViewProps={{
              messages,
              quickReplyOptions,
              onQuickReplyClick: handleQuickReply,
              messageFieldProps: {
                handleSend,
                aiIsTyping,
                isChatFinished: conversationCompleted,
                isUploadingCv: isUploadingCv || activeUploads.size > 0,
                onUploadCv: handleUploadCv,
                currentPhase: currentPhase.phase,
                prefillMessage,
                failedSendDraft,
                cvUploadError,
                fillColor: theme.palette.secondary.main,
                isInputDisabled: isAwaitingBWSResponse,
                placeholderKey: isAwaitingBWSResponse ? "chat.chatMessageField.placeholders.bws" : undefined,
              },
              children: showBackdrop ? <InactiveBackdrop isShown={showBackdrop} /> : undefined,
            }}
            belowChatView={
              conversationCompleted && nextModule ? (
                <ModuleHandoffBanner
                  nextModuleLabel={t(nextModule.labelKey as any)}
                  nextModuleRoute={nextModule.route}
                />
              ) : undefined
            }
            sidebar={<SkillsDiscoverySidebar currentPhase={currentPhase} refreshToken={sidebarRefreshToken} />}
          />
        </Box>
        {showRefreshConfirmDialog && (
          <ConfirmModalDialog
            isOpen={showRefreshConfirmDialog}
            title={t("chat.chat.refreshConfirmationDialog.title")}
            content={
              <>
                {t("chat.chat.refreshConfirmationDialog.content", { appName })}
                <br />
                <br />
                {t("chat.chat.refreshConfirmationDialog.question", { appName })}
              </>
            }
            onCancel={handleCancelRefresh}
            onConfirm={handleConfirmRefresh}
            onDismiss={handleCancelRefresh}
            cancelButtonText={t("chat.chat.refreshConfirmationDialog.waitButton", { appName })}
            confirmButtonText={t("chat.chat.refreshConfirmationDialog.refreshButton")}
          />
        )}
        {newSessionEnabled && newConversationDialog && (
          <ConfirmModalDialog
            isOpen={newConversationDialog}
            title={t("chat.chat.startNewConversationDialog.title")}
            content={
              <>
                {t("chat.chat.startNewConversationDialog.content")}
                <br />
                <br />
                {t("chat.chat.startNewConversationDialog.confirmation")}
              </>
            }
            onCancel={() => setNewConversationDialog(false)}
            onConfirm={handleConfirmNewConversation}
            onDismiss={() => setNewConversationDialog(false)}
            cancelButtonText={t("common.buttons.cancel")}
            confirmButtonText={t("common.buttons.confirm")}
          />
        )}
      </ChatProvider>
    </Suspense>
  );
};

export default Chat;
