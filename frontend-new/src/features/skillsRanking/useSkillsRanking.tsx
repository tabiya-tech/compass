import { useCallback, useEffect, useRef, useState } from "react";
import {
  SkillsRankingCurrentState,
  SkillsRankingState,
  skillsRankingStateDefault,
} from "src/features/skillsRanking/types";
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
import CancellableTypingChatMessage, { CANCELABLE_TYPING_CHAT_MESSAGE_TYPE, CancellableTypingChatMessageProps } from "./components/cancellableTypingChatMessage/CancellableTypingChatMessage";
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
  const onFinishRef = useRef<(() => void) | null>(null);
  const lastHandledState = useRef<SkillsRankingCurrentState | null>(null);
  // we could use the original messages array from the chat context, but this didnt seem like a good enough reason to expose that to all the children
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

  const handleStateTransition = useCallback(async (newState: SkillsRankingCurrentState, rank?: string) => {
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
    if (lastHandledState.current === state.current_state) return;
    lastHandledState.current = state.current_state;

    const showTypingAndThen = (callback: () => void) => {
      let typingMsg: IChatMessage<TypingChatMessageProps> | null = null;

      // for skipped or cancelled states, we don't want to show the typing message since we're going to call onFinish
      // and it will handle showing the appropriate typing message
      // and for evaluated state, the cancelable typing message will be shown before we even transition state so we dont need to show a typing message here
      if (state.current_state !== SkillsRankingCurrentState.SKIPPED && state.current_state !== SkillsRankingCurrentState.CANCELLED && state.current_state !== SkillsRankingCurrentState.EVALUATED) {
        typingMsg = generateTypingMessage();
        addMessage(typingMsg);
      }

      // if there is a typing message, we want to wait for the timeout to show the components
      // otherwise, we want to call the callback immediately
      const timeoutId = setTimeout(() => {
        if (typingMsg) {
          removeMessage(typingMsg.message_id);
        }
        callback();
      }, typingMsg ? TYPING_TIMEOUT : 0);
      
      pendingTimeouts.current['showMessage'] = timeoutId;
    };

    const handleState = () => {
      switch (state.current_state) {
        case SkillsRankingCurrentState.INITIAL:
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE])) {
            addMessage(createMessage(SKILLS_RANKING_PROMPT_MESSAGE_TYPE, {
              message: "Please rate your skills",
              onView: async () => {
                const newState = await handleStateTransition(SkillsRankingCurrentState.SELF_EVALUATING);
                if (newState) handleStateMessages(newState, onFinish);
              },
              onSkip: async () => {
                removeMessage(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
                const newState = await handleStateTransition(SkillsRankingCurrentState.SKIPPED);
                if (newState) handleStateMessages(newState, onFinish);
              },
              disabled: false,
              skillsRankingState: state,
            }, SkillsRankingPrompt));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
          }
          break;

        case SkillsRankingCurrentState.SELF_EVALUATING:
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE])) {
            addMessage(createMessage(SKILLS_RANKING_PROMPT_MESSAGE_TYPE, {
              message: "Please rate your skills",
              onView: async () => {
                const newState = await handleStateTransition(SkillsRankingCurrentState.SELF_EVALUATING);
                if (newState) handleStateMessages(newState, onFinish);
              },
              onSkip: async () => {
                removeMessage(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
                const newState = await handleStateTransition(SkillsRankingCurrentState.SKIPPED);
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
                    removeMessage(SkillsRankingMessageIds[CANCELABLE_TYPING_CHAT_MESSAGE_TYPE]);
                    const newState = await handleStateTransition(SkillsRankingCurrentState.CANCELLED);
                    if (newState) handleStateMessages(newState, onFinish);
                  },
                }, CancellableTypingChatMessage);
                addMessage(cancelableTypingMsg);

                // Wait for typing timeout before transitioning state
                const timeoutId = setTimeout(async () => {
                  removeMessage(cancelableTypingMsg.message_id);
                  const newState = await handleStateTransition(SkillsRankingCurrentState.EVALUATED, rank);
                  if (newState) handleStateMessages(newState, onFinish);
                }, CANCELABLE_TYPING_TIMEOUT);
                
                pendingTimeouts.current['rankSelect'] = timeoutId;
              },
              skillsRankingState: state,
            }, SkillsRankingVote));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE]);
          }
          break;

        case SkillsRankingCurrentState.EVALUATED:
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE])) {
            addMessage(createMessage(SKILLS_RANKING_PROMPT_MESSAGE_TYPE, {
              message: "Please rate your skills",
              onView: async () => {
                const newState = await handleStateTransition(SkillsRankingCurrentState.SELF_EVALUATING);
                if (newState) handleStateMessages(newState, onFinish);
              },
              onSkip: async () => {
                removeMessage(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
                const newState = await handleStateTransition(SkillsRankingCurrentState.SKIPPED);
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
                const newState = await handleStateTransition(SkillsRankingCurrentState.EVALUATED, rank);
                if (newState) handleStateMessages(newState, onFinish);
              },
              skillsRankingState: state,
            }, SkillsRankingVote));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE]);
          }
          
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_RESULT_MESSAGE_TYPE])) {
            addMessage(createMessage(SKILLS_RANKING_RESULT_MESSAGE_TYPE, {
              message: "Here's what we found",
              onError: handleError,
              skillsRankingState: state,
            }, SkillsRankingResult));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_RESULT_MESSAGE_TYPE]);
          }
          
          const finishTimeoutId = setTimeout(() => {
            onFinish();
          }, DELAY_AFTER_RESULTS);
          
          pendingTimeouts.current['finish'] = finishTimeoutId;
          break;

        case SkillsRankingCurrentState.SKIPPED:
        case SkillsRankingCurrentState.CANCELLED:
          // removeMessage(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
          // removeMessage(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE]);
          // removeMessage(SkillsRankingMessageIds[SKILLS_RANKING_RESULT_MESSAGE_TYPE]);
          console.debug("SKIPPED or CANCELLED, calling onFinish");
          onFinish();
          break;
      }
    };

    showTypingAndThen(handleState);
  }, [addMessage, removeMessage, createMessage, handleStateTransition, handleError, clearAllPendingTimeouts]);

  const showSkillsRanking = useCallback(async (onFinish: () => void) => {
    clearAllPendingTimeouts();
    shownMessages.current.clear(); // Reset shown messages when starting a new flow
    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (!sessionId) throw new Error("No active session found");
      
      const state = await SkillsRankingService.getInstance().getSkillsRankingState(sessionId);
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
  }, [currentSkillsRankingState.current_state, handleStateMessages, currentSkillsRankingState]);

  return { showSkillsRanking };
}; 