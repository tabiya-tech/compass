import { useCallback, useEffect, useRef, useState } from "react";
import { SkillsRankingPhase, SkillsRankingState, skillsRankingStateDefault } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IChatMessage } from "src/chat/Chat.types";
import SkillsRankingPrompt, {
  SKILLS_RANKING_PROMPT_MESSAGE_TYPE,
  SkillsRankingPromptProps,
} from "src/features/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import SkillsRankingVote, {
  SKILLS_RANKING_VOTE_MESSAGE_TYPE,
  SkillsRankingVoteProps,
} from "src/features/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import SkillsRankingResult, {
  SKILLS_RANKING_RESULT_MESSAGE_TYPE,
  SkillsRankingResultProps,
} from "src/features/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { SkillsRankingError } from "./errors";
import CancellableTypingChatMessage, {
  CANCELABLE_TYPING_CHAT_MESSAGE_TYPE,
  CancellableTypingChatMessageProps,
} from "./components/cancellableTypingChatMessage/CancellableTypingChatMessage";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { generateTypingMessage } from "src/chat/util";
import { TypingChatMessageProps } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";

type SkillsRankingMessageProps = SkillsRankingPromptProps | SkillsRankingVoteProps | SkillsRankingResultProps | CancellableTypingChatMessageProps;

const TYPING_TIMEOUT = 5000; // 5 seconds
const CANCELABLE_TYPING_TIMEOUT = 10000; // 10 seconds
const DELAY_AFTER_RESULTS = 3000; // 3 seconds

const SkillsRankingMessageIds = {
  [SKILLS_RANKING_PROMPT_MESSAGE_TYPE]: "skills-ranking-prompt-message",
  [SKILLS_RANKING_VOTE_MESSAGE_TYPE]: "skills-ranking-vote-message",
  [SKILLS_RANKING_RESULT_MESSAGE_TYPE]: "skills-ranking-result-message",
  [CANCELABLE_TYPING_CHAT_MESSAGE_TYPE]: "skills-ranking-cancellable-typing-message",
} as const;

export const useSkillsRanking = (addMessage: (message: IChatMessage<any>) => void, removeMessage: (messageId: string) => void) => {
  const pendingTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const [currentSkillsRankingState, setCurrentSkillsRankingState] = useState<SkillsRankingState>(skillsRankingStateDefault);
  const [ranking, setRanking] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onFinishRef = useRef<(() => void) | null>(null);
  const lastHandledState = useRef<SkillsRankingPhase | null>(null);
  const shownMessages = useRef<Set<string>>(new Set());
  const { enqueueSnackbar } = useSnackbar();

  const handleError = useCallback((error: Error) => {
    console.error(new SkillsRankingError("Error in skills ranking flow:", error));
    enqueueSnackbar("An error occurred while calculating your skills ranking. Please try again later.", {
      variant: "error",
    });
  }, [enqueueSnackbar]);

  const clearAllPendingTimeouts = useCallback(() => {
    Object.values(pendingTimeouts.current).forEach(timeout => clearTimeout(timeout));
    pendingTimeouts.current = {};
  }, []);

  const createMessage = useCallback(<T extends SkillsRankingMessageProps>(type: string, props: T, Component: React.ComponentType<T>): IChatMessage<T> => ({
    message_id: SkillsRankingMessageIds[type as keyof typeof SkillsRankingMessageIds],
    type,
    payload: props,
    sender: ConversationMessageSender.COMPASS,
    component: (props: T) => <Component {...props} />,
  }), []);

  const fetchRanking = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (sessionId === null) {
        throw new Error("No active session found");
      }
      const skillsRankingService = SkillsRankingService.getInstance();
      const result = await skillsRankingService.getRanking(sessionId, signal);
      setRanking(result.ranking);
      return result.ranking;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Ranking fetch was aborted');
        return null;
      }
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch ranking";
      handleError(error instanceof Error ? error : new Error(errorMessage));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const handleStateTransition = useCallback(async (newState: SkillsRankingPhase, rank?: string) => {
    const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!sessionId) return;
    
    try {
      const state = await SkillsRankingService.getInstance().updateSkillsRankingState(
        sessionId,
        newState,
        rank
      );
      setCurrentSkillsRankingState(state);
      return state;
    } catch (error) {
      handleError(error as Error);
      return null;
    }
  }, [handleError]);

  const handleStateMessages = useCallback((state: SkillsRankingState, onFinish: () => void) => {
    if (lastHandledState.current === state.phase) return;
    lastHandledState.current = state.phase;

    const showTypingAndThen = (callback: () => void) => {
      let typingMsg: IChatMessage<TypingChatMessageProps> | null = null;

      if (state.phase !== SkillsRankingPhase.SKIPPED && state.phase !== SkillsRankingPhase.CANCELLED && state.phase !== SkillsRankingPhase.EVALUATED) {
        typingMsg = generateTypingMessage();
        addMessage(typingMsg);
      }

      pendingTimeouts.current['showMessage'] = setTimeout(() => {
        if (typingMsg) {
          removeMessage(typingMsg.message_id);
        }
        callback();
      }, typingMsg ? TYPING_TIMEOUT : 0);
    };

    const handleState = () => {
      switch (state.phase) {
        case SkillsRankingPhase.INITIAL:
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE])) {
            addMessage(createMessage(SKILLS_RANKING_PROMPT_MESSAGE_TYPE, {
              message: "Please rate your skills",
              onView: async () => {
                const newState = await handleStateTransition(SkillsRankingPhase.SELF_EVALUATING);
                if (newState) handleStateMessages(newState, onFinish);
              },
              onSkip: async () => {
                removeMessage(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
                const newState = await handleStateTransition(SkillsRankingPhase.SKIPPED);
                if (newState) handleStateMessages(newState, onFinish);
              },
              disabled: false,
              skillsRankingState: state,
            }, SkillsRankingPrompt));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
          }
          break;

        case SkillsRankingPhase.SELF_EVALUATING:
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE])) {
            addMessage(createMessage(SKILLS_RANKING_PROMPT_MESSAGE_TYPE, {
              message: "Please rate your skills",
              onView: async () => {
                const newState = await handleStateTransition(SkillsRankingPhase.SELF_EVALUATING);
                if (newState) handleStateMessages(newState, onFinish);
              },
              onSkip: async () => {
                removeMessage(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
                const newState = await handleStateTransition(SkillsRankingPhase.SKIPPED);
                if (newState) handleStateMessages(newState, onFinish);
              },
              disabled: true,
              skillsRankingState: state,
            }, SkillsRankingPrompt));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
          }
          
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE])) {
            addMessage(createMessage(SKILLS_RANKING_VOTE_MESSAGE_TYPE, {
              message: "Please rate your skills",
              onRankSelect: async (rank: string) => {
                // Show typing message first
                const cancelableTypingMsg = createMessage(CANCELABLE_TYPING_CHAT_MESSAGE_TYPE, {
                  message: "Calculating your skills ranking",
                  onCancel: async () => {
                    clearAllPendingTimeouts();
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort();
                      abortControllerRef.current = null;
                    }
                    removeMessage(SkillsRankingMessageIds[CANCELABLE_TYPING_CHAT_MESSAGE_TYPE]);
                    const newState = await handleStateTransition(SkillsRankingPhase.CANCELLED);
                    if (newState) handleStateMessages(newState, onFinish);
                  },
                }, CancellableTypingChatMessage);
                addMessage(cancelableTypingMsg);

                // Start fetching ranking
                abortControllerRef.current = new AbortController();
                await fetchRanking(abortControllerRef.current.signal);

                // Wait for typing timeout before transitioning state
                pendingTimeouts.current['rankSelect'] = setTimeout(async () => {
                  removeMessage(cancelableTypingMsg.message_id);
                  const newState = await handleStateTransition(SkillsRankingPhase.EVALUATED, rank);
                  if (newState) handleStateMessages(newState, onFinish);
                }, CANCELABLE_TYPING_TIMEOUT);
              },
              skillsRankingState: state,
            }, SkillsRankingVote));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE]);
          }
          break;

        case SkillsRankingPhase.EVALUATED:
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE])) {
            addMessage(createMessage(SKILLS_RANKING_PROMPT_MESSAGE_TYPE, {
              message: "Please rate your skills",
              onView: async () => {
                const newState = await handleStateTransition(SkillsRankingPhase.SELF_EVALUATING);
                if (newState) handleStateMessages(newState, onFinish);
              },
              onSkip: async () => {
                removeMessage(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
                const newState = await handleStateTransition(SkillsRankingPhase.SKIPPED);
                if (newState) handleStateMessages(newState, onFinish);
              },
              disabled: true,
              skillsRankingState: state,
            }, SkillsRankingPrompt));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
          }
          
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE])) {
            addMessage(createMessage(SKILLS_RANKING_VOTE_MESSAGE_TYPE, {
              message: "Please rate your skills",
              onRankSelect: async (rank: string) => {
                const newState = await handleStateTransition(SkillsRankingPhase.EVALUATED, rank);
                if (newState) handleStateMessages(newState, onFinish);
              },
              skillsRankingState: state,
            }, SkillsRankingVote));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE]);
          }
          console.log('state:', state);
          
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_RESULT_MESSAGE_TYPE])) {
            addMessage(createMessage(SKILLS_RANKING_RESULT_MESSAGE_TYPE, {
              message: "Here's what we found",
              skillsRankingState: state,
              isLoading,
            }, SkillsRankingResult));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_RESULT_MESSAGE_TYPE]);
          }
          
          const finishTimeoutId = setTimeout(() => {
            onFinish();
          }, DELAY_AFTER_RESULTS);
          
          pendingTimeouts.current['finish'] = finishTimeoutId;
          break;

        case SkillsRankingPhase.SKIPPED:
        case SkillsRankingPhase.CANCELLED:
          console.debug("SKIPPED or CANCELLED, calling onFinish");
          onFinish();
          break;
      }
    };

    showTypingAndThen(handleState);
  }, [addMessage, removeMessage, createMessage, handleStateTransition, clearAllPendingTimeouts, fetchRanking, isLoading]);

  const showSkillsRanking = useCallback(async (onFinish: () => void) => {
    clearAllPendingTimeouts();
    shownMessages.current.clear(); // Reset shown messages when starting a new flow
    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (!sessionId) throw new Error("No active session found");
      
      let state = await SkillsRankingService.getInstance().getSkillsRankingState(sessionId);
      // If no state exists, create one with INITIAL phase
      state ??= await SkillsRankingService.getInstance().updateSkillsRankingState(
        sessionId,
        SkillsRankingPhase.INITIAL,
      );
      setCurrentSkillsRankingState(state);
      onFinishRef.current = onFinish;
      handleStateMessages(state, onFinish);
    } catch (error) {
      console.error("Error in skills ranking flow:", error);
      onFinish();
    }
  }, [clearAllPendingTimeouts, handleStateMessages]);

  useEffect(() => {
    if (onFinishRef.current) {
      handleStateMessages(currentSkillsRankingState, onFinishRef.current);
      onFinishRef.current = null;
    }
  }, [ranking, isLoading, currentSkillsRankingState.phase, handleStateMessages, currentSkillsRankingState]);

  return { showSkillsRanking };
}; 