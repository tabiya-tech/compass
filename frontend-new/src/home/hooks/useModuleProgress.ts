import { useEffect, useMemo, useState } from "react";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import ChatService from "src/chat/ChatService/ChatService";
import { ConversationResponse } from "src/chat/ChatService/ChatService.types";
import { ConversationPhase } from "src/chat/chatProgressbar/types";
import { ChatError } from "src/error/commonErrors";
import { BADGE_STATUS, BadgeStatus } from "src/home/constants";

const MODULE_IDS = ["skills_discovery", "career_explorer", "job_readiness", "knowledge_hub", "job_matching"] as const;
const TOTAL_MODULE_COUNT = MODULE_IDS.length;

/**
 * Hook to calculate module progress and determine badge status for modules
 *
 * For Skills & Interests module:
 * - Shows "Continue" badge when the conversation phase is COLLECT_EXPERIENCES
 * - Shows "Completed" badge when the conversation phase is ENDED
 * - Shows no badge for other phases or when no active session
 */
export const useModuleProgress = () => {
  const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();
  const sessions = userPreferences?.sessions;

  const [chatHistory, setChatHistory] = useState<ConversationResponse | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Fetch chat history on mount, reading the active session ID fresh from the singleton
  // so we always get the session created during the current app session, not a stale snapshot.
  useEffect(() => {
    const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!activeSessionId) {
      setChatHistory(null);
      return;
    }

    let isMounted = true;
    setIsLoadingHistory(true);

    ChatService.getInstance()
      .getChatHistory(activeSessionId)
      .then((history) => {
        if (isMounted) {
          setChatHistory(history);
          setIsLoadingHistory(false);
        }
      })
      .catch((error) => {
        console.warn(new ChatError("Failed to fetch chat history for badge status", error));
        if (isMounted) {
          setChatHistory(null);
          setIsLoadingHistory(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Tracks whether the user has started at least one module.
  const isModuleStarted = useMemo(() => {
    return Array.isArray(sessions) && sessions.length > 0;
  }, [sessions]);

  const completedModulesCount = useMemo(() => {
    const phase = chatHistory?.current_phase?.phase;

    // For now, only Skills & Interests has a known completion signal.
    return MODULE_IDS.filter((moduleId) => {
      if (moduleId === "skills_discovery") {
        return phase === ConversationPhase.ENDED;
      }
      // Add completion conditions for the remaining modules.

      return false;
    }).length;
  }, [chatHistory]);

  // Calculate overall progress across all modules.
  const overallProgress = useMemo(() => {
    return (completedModulesCount / TOTAL_MODULE_COUNT) * 100;
  }, [completedModulesCount]);

  // Get badge status for a specific module based on conversation phase
  const getBadgeStatus = (moduleId: string): BadgeStatus => {
    // Only show badges for Skills & Interests module
    if (moduleId !== "skills_discovery") {
      return null;
    }

    // Don't show badge if history hasn't loaded yet
    if (isLoadingHistory || !chatHistory) {
      return null;
    }

    const phase = chatHistory.current_phase?.phase;

    if (phase === ConversationPhase.COLLECT_EXPERIENCES) {
      return BADGE_STATUS.CONTINUE;
    }

    if (phase === ConversationPhase.ENDED) {
      return BADGE_STATUS.COMPLETED;
    }

    return null;
  };

  return {
    overallProgress,
    getBadgeStatus,
    isModuleStarted,
  };
};
