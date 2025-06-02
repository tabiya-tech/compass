import { useCallback, useEffect, useRef, useState } from "react";
import { SkillsRankingPhase, SkillsRankingState, skillsRankingStateDefault } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IChatMessage } from "src/chat/Chat.types";
import SkillsRankingPrompt, { SKILLS_RANKING_PROMPT_MESSAGE_TYPE } from "./components/skillsRankingPrompt/SkillsRankingPrompt";
import SkillsRankingVote, { SKILLS_RANKING_VOTE_MESSAGE_TYPE } from "./components/skillsRankingVote/SkillsRankingVote";
import SkillsRankingResult, { SKILLS_RANKING_RESULT_MESSAGE_TYPE } from "./components/skillsRankingResult/SkillsRankingResult";
import CancellableTypingChatMessage, { CANCELABLE_TYPING_CHAT_MESSAGE_TYPE } from "./components/cancellableTypingChatMessage/CancellableTypingChatMessage";
import { generateTypingMessage } from "src/chat/util";
import { TypingChatMessageProps } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { createMessage } from "src/features/skillsRanking/utils/createMessage";
import { useSkillsRankingState } from "./utils/useSkillsRankingState";
import { useGetRankingResult } from "./utils/useGetRankingResult";
import { SessionError } from "src/error/commonErrors";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { CANCELABLE_TYPING_TIMEOUT, DELAY_AFTER_RESULTS, SkillsRankingMessageIds, TYPING_TIMEOUT } from "./constants";

export const useSkillsRanking = (addMessage: (message: IChatMessage<any>) => void, removeMessage: (messageId: string) => void) => {
  const currentTimeout = useRef<NodeJS.Timeout | null>(null);
  const [currentSkillsRankingState, setCurrentSkillsRankingState] = useState<SkillsRankingState>(skillsRankingStateDefault);
  const onFinishRef = useRef<(() => void) | null>(null);
  const shownMessages = useRef<Set<string>>(new Set()); 

  const { handleStateTransition, lastHandledState } = useSkillsRankingState();
  const { fetchRanking, isLoading, ranking } = useGetRankingResult();

  const clearCurrentTimeout = useCallback(() => {
    if (currentTimeout.current) {
      clearTimeout(currentTimeout.current);
      currentTimeout.current = null;
    }
  }, []);

  const handleSkillsRankingMessageFlow = useCallback((state: SkillsRankingState) => {
    if (lastHandledState.current === state.phase) return;
    lastHandledState.current = state.phase;
    let abortController: AbortController | null = null;

    /*
    * shows a typing message for a certain amount of time, then calls the callback function.
    * this is used to simulate typing in the chat before showing the next message.
    *
    * since the flow is called after every state change, wrapping the message creation in a typing message
    * allows us to show a typing indicator before showing the next message.
    *
    * unless the phase is SKIPPED, CANCELLED or EVALUATED, in which case we don't show the typing message. (they have their own internal way of showing typing)
    * */
    const showTypingAndThen = (callback: () => void) => {
      let typingMsg: IChatMessage<TypingChatMessageProps> | null = null;

      if (state.phase !== SkillsRankingPhase.SKIPPED && state.phase !== SkillsRankingPhase.CANCELLED && state.phase !== SkillsRankingPhase.EVALUATED) {
        typingMsg = generateTypingMessage();
        addMessage(typingMsg);
      }

      clearCurrentTimeout();
      currentTimeout.current = setTimeout(() => {
        if (typingMsg) {
          removeMessage(typingMsg.message_id);
        }
        callback();
      }, typingMsg ? TYPING_TIMEOUT : 0);
    };

    /* * ----------------
    * reusable message creation functions
    * These functions create the messages that will be shown in the chat based on the current state of the skills ranking flow.
    * */
    const createPromptMessage = (state: SkillsRankingState, disabled: boolean) => {
      return createMessage(SKILLS_RANKING_PROMPT_MESSAGE_TYPE, {
        message: "Now that we've discovered your skills, we would like to ask you a few questions about them...",
        onView: async () => {
          const newState = await handleStateTransition(SkillsRankingPhase.SELF_EVALUATING);
          if (newState) {
            setCurrentSkillsRankingState(newState);
            handleSkillsRankingMessageFlow(newState);
          }
        },
        onSkip: async () => {
          removeMessage(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
          const newState = await handleStateTransition(SkillsRankingPhase.SKIPPED);
          if (newState) {
            setCurrentSkillsRankingState(newState);
            handleSkillsRankingMessageFlow(newState);
          }
        },
        disabled,
        skillsRankingState: state,
      }, SkillsRankingPrompt);
    };

    /*
    * We're interested in knowing if the user cancels the typing message while the ranking is being fetched.
    * This function will cancel the current timeout, abort the fetch request if it exists, and then send a new state with the CANCELLED phase.
    * */
    const createCancellableTypingMessage = (state: SkillsRankingState) => {
      return createMessage(CANCELABLE_TYPING_CHAT_MESSAGE_TYPE, {
        message: "Calculating your skills ranking",
        onCancel: async () => {
          clearCurrentTimeout();
          if (abortController) {
            abortController.abort();
            abortController = null;
          }
          removeMessage(SkillsRankingMessageIds[CANCELABLE_TYPING_CHAT_MESSAGE_TYPE]);
          const newState = await handleStateTransition(SkillsRankingPhase.CANCELLED);
          if (newState) {
            setCurrentSkillsRankingState(newState);
            handleSkillsRankingMessageFlow(newState);
          }
        },
      }, CancellableTypingChatMessage);
    };

    /*
    * When a vote is selected, we show a typing message first, then fetch the ranking.
    * we add an artifical delay and give the user the option to cancel the typing message.
    * */
    const createVoteMessage = (state: SkillsRankingState, disabled: boolean) => {
      return createMessage(SKILLS_RANKING_VOTE_MESSAGE_TYPE, {
        message: "This question is designed to gauge your self-perception of your skills. Please select the rank that best represents your current skill level.",
        onRankSelect: async (rank: string) => {
          // Show typing message first
          const cancelableTypingMsg = createCancellableTypingMessage(state);
          addMessage(cancelableTypingMsg);

          // Start fetching ranking
          abortController = new AbortController();
          await fetchRanking(abortController.signal);

          // Wait for typing timeout before transitioning state
          clearCurrentTimeout();
          currentTimeout.current = setTimeout(async () => {
            removeMessage(cancelableTypingMsg.message_id);
            const newState = await handleStateTransition(SkillsRankingPhase.EVALUATED, rank);
            if (newState) {
              setCurrentSkillsRankingState(newState);
              handleSkillsRankingMessageFlow(newState);
            }
          }, CANCELABLE_TYPING_TIMEOUT);
        },
        disabled,
        skillsRankingState: state,
      }, SkillsRankingVote);
    };

    const createResultMessage = (state: SkillsRankingState) => {
      return createMessage(SKILLS_RANKING_RESULT_MESSAGE_TYPE, {
        message: "Here's what we found",
        skillsRankingState: state,
        isLoading,
      }, SkillsRankingResult);
    };

    /* * ----------------
    * Responsible for adding the appropriate messages to the chat based on the current phase of the skills ranking flow.
    * There are two possible ways to reach this point:
    *   1. we are loading the state in an intermediate step (for example during a reload) and we need to reconstruct the appropriate messages
    *     for each previous phase as well as the current one
    *   2. we are in the middle of the flow and we need to add the messages for the current phase (move from one phase to another)
    * so this function is called every time the state changes, and it will add the appropriate messages to the chat if they arent already shown.
    * */
    const addSkillsRankingMessagesToChat = () => {
      switch (state.phase) {
        case SkillsRankingPhase.INITIAL:
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE])) {
            addMessage(createPromptMessage(state, false));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
          }
          break;

        case SkillsRankingPhase.SELF_EVALUATING:
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE])) {
            addMessage(createPromptMessage(state, true));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
          }
          
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE])) {
            addMessage(createVoteMessage(state, false));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE]);
          }
          break;
        case SkillsRankingPhase.EVALUATED:
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE])) {
            addMessage(createPromptMessage(state, true));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_PROMPT_MESSAGE_TYPE]);
          }
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE])) {
            addMessage(createVoteMessage(state, true));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_VOTE_MESSAGE_TYPE]);
          }
          if (!shownMessages.current.has(SkillsRankingMessageIds[SKILLS_RANKING_RESULT_MESSAGE_TYPE])) {
            addMessage(createResultMessage(state));
            shownMessages.current.add(SkillsRankingMessageIds[SKILLS_RANKING_RESULT_MESSAGE_TYPE]);
          }
                    
          clearCurrentTimeout();
          currentTimeout.current = setTimeout(() => {
            //  we expect onFinish to be set by the caller
            onFinishRef.current!();
          }, DELAY_AFTER_RESULTS);

          break;
        case SkillsRankingPhase.SKIPPED:
        case SkillsRankingPhase.CANCELLED:
          console.debug("SKIPPED or CANCELLED, calling onFinish");
          //  we expect onFinish to be set by the caller
          onFinishRef.current!();
          break;
      }
    };

    showTypingAndThen(addSkillsRankingMessagesToChat);
  }, [addMessage, removeMessage, handleStateTransition, clearCurrentTimeout, fetchRanking, isLoading, lastHandledState]);

  /*
  * This is the entry point for showing the skills ranking flow.
  * The main responsibilities of the is function are:
  *   1. to get the skills ranking state of this session from the backend
  *   2. to trigger an initialization of the skills ranking state if it doesn't exist yet (send an update request with an INITIAL phase)
  *   3. to set the onFinish callback that will be called when the flow is done to a ref so that we can access it later
  * from the handleSkillsRankingMessageFlow function.
  * */
  const showSkillsRanking = useCallback(async (onFinish: () => void) => {
    clearCurrentTimeout();
    shownMessages.current.clear(); // Reset shown messages when starting a new flow
    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (!sessionId) throw new SessionError("No active session found");
      
      let state = await SkillsRankingService.getInstance().getSkillsRankingState(sessionId);
      // If no state exists, create one with INITIAL phase
      if (!state) {
        const newState = await handleStateTransition(SkillsRankingPhase.INITIAL);
        if (!newState) {
          return;
        }
        state = newState;
      }
      setCurrentSkillsRankingState(state);
      // set onFinish callback to be called when the flow is done
      onFinishRef.current = onFinish;
      handleSkillsRankingMessageFlow(state);
    } catch (error) {
      // we dont use the handleError here since we dont want to show a snackbar if initializing the skills ranking flow fails
      // we simply want to move on and call the onFinish callback
      console.error(new SkillsRankingError("Error in skills ranking flow:", error));
      //  we expect onFinish to be set by the caller
      onFinishRef.current!();
    }
  }, [clearCurrentTimeout, handleSkillsRankingMessageFlow, handleStateTransition]);


  /*
  * Once the onFinish callback is set by the entry point function, we use this useEffect to trigger the skills ranking message flow.
  * */
  useEffect(() => {
    if (onFinishRef.current) {
      handleSkillsRankingMessageFlow(currentSkillsRankingState);
    }
  }, [ranking, isLoading, currentSkillsRankingState.phase, handleSkillsRankingMessageFlow, currentSkillsRankingState]);

  return { showSkillsRanking };
}; 