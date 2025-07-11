import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IChatMessage } from "../../../chat/Chat.types";
import { SkillsRankingService } from "../skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "../errors";
import { SessionError } from "../../../error/commonErrors";
import { SkillsRankingPhase, SkillsRankingState } from "../types";
import {
  skillsRankingHappyPath,
  skillsRankingSadPath,
} from "./skillsRankingFlowGraph";
import {
  createBriefingMessage,
  createEffortMessage,
  createJobSeekerDisclosureMessage,
  createJobMarketDisclosureMessage,
  createPerceivedRankMessage,
  createPromptMessage,
  createRetypedRankMessage,
} from "../utils/createMessages";
import { generateTypingMessage } from "../../../chat/util";

const TYPING_MESSAGE_TIMEOUT = 5000

const phaseToMessageFactory = {
  [SkillsRankingPhase.BRIEFING]: createBriefingMessage,
  [SkillsRankingPhase.EFFORT]: createEffortMessage,
  [SkillsRankingPhase.DISCLOSURE]: (state: SkillsRankingState, onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>) => {
    const first = createJobSeekerDisclosureMessage(state, onFinish);
    const second = createJobMarketDisclosureMessage(state, onFinish);
    return [first, second];
  },
  [SkillsRankingPhase.PERCEIVED_RANK]: createPerceivedRankMessage,
  [SkillsRankingPhase.RETYPED_RANK]: createRetypedRankMessage,
  [SkillsRankingPhase.COMPLETED]: null,
  [SkillsRankingPhase.CANCELLED]: null,
  [SkillsRankingPhase.INITIAL]: createPromptMessage,
};

export const useSkillsRanking = (
  addMessage: (message: IChatMessage<any>) => void,
  removeMessage: (messageId: string) => void,
) => {
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

  const getSkillsRankingState = async (): Promise<SkillsRankingState | null> => {
    if (!activeSessionId) throw new SessionError("Active session ID is not available.");
    try {
      return await SkillsRankingService.getInstance().getSkillsRankingState(activeSessionId);
    } catch (error) {
      console.error(new SkillsRankingError("Error fetching skills ranking state:", error));
      return null;
    }
  };

  const initializeSkillsRankingState = async (): Promise<SkillsRankingState | null> => {
    if (!activeSessionId) throw new SessionError("Active session ID is not available.");
    try {
      return await SkillsRankingService.getInstance().updateSkillsRankingState(activeSessionId, SkillsRankingPhase.INITIAL);
    } catch (error) {
      console.error(new SkillsRankingError("Error initializing skills ranking state:", error));
      return null;
    }
  };

  const getPathToPhase = (phase: SkillsRankingPhase): SkillsRankingPhase[] => {
    const path = skillsRankingSadPath.includes(phase) ? skillsRankingSadPath : skillsRankingHappyPath;
    const index = path.indexOf(phase);
    return path.slice(0, index + 1);
  };

  const handleFlow = (currentPhase: SkillsRankingPhase, onFinishFlow: () => void) => async (newState: SkillsRankingState) => {
    const typingMessage = generateTypingMessage();
    addMessage(typingMessage);

    setTimeout(() => {
      removeMessage(typingMessage.message_id);
      
      // Check if the new state is cancelled or completed
      if (
        newState.phase === SkillsRankingPhase.CANCELLED ||
        newState.phase === SkillsRankingPhase.COMPLETED
      ) {
        onFinishFlow();
        return;
      }
      
      const nextPhaseIndex = getPathToPhase(newState.phase).indexOf(currentPhase) + 1;
      console.debug(`going from ${currentPhase} to ${getPathToPhase(newState.phase)[getPathToPhase(newState.phase).indexOf(currentPhase) + 1]}`);
      const path = getPathToPhase(newState.phase);
      const nextPhase = path[nextPhaseIndex];
      const factory = phaseToMessageFactory[nextPhase];
      if (nextPhase && factory) {
        const result = factory(newState, handleFlow(nextPhase, onFinishFlow));
        (Array.isArray(result) ? result : [result]).forEach(addMessage);
      }
    }, TYPING_MESSAGE_TIMEOUT);
  };

  const showSkillsRanking = async (onFinishFlow: () => void) => {
    const typingMessage = generateTypingMessage();
    addMessage(typingMessage);
    let state = await getSkillsRankingState();
    state ??= await initializeSkillsRankingState();
    if (!state) {
      removeMessage(typingMessage.message_id);
      onFinishFlow();
      throw new SkillsRankingError("Skills ranking state is still null after initialization.");
    }

    const path = getPathToPhase(state.phase);
    let result: SkillsRankingState = state
    path.forEach((phase) => {
      const factory = phaseToMessageFactory[phase];
      if (factory) {
        removeMessage(typingMessage.message_id);
        const result = factory(state, handleFlow(phase, onFinishFlow));
        (Array.isArray(result) ? result : [result]).forEach(addMessage);
      }
    });

    if (
      result.phase === SkillsRankingPhase.CANCELLED ||
      result.phase === SkillsRankingPhase.COMPLETED
    ) {
      onFinishFlow();
    }
  };

  return { showSkillsRanking };
};