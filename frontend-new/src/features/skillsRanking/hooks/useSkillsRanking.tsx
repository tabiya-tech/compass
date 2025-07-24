import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IChatMessage } from "src/chat/Chat.types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { SessionError } from "src/error/commonErrors";
import { SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
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
} from "src/features/skillsRanking/utils/createMessages";

const phaseToMessageFactory = {
  [SkillsRankingPhase.INITIAL]: createPromptMessage,
  [SkillsRankingPhase.BRIEFING]: createBriefingMessage,
  [SkillsRankingPhase.PROOF_OF_VALUE]: createEffortMessage,
  [SkillsRankingPhase.MARKET_DISCLOSURE]: createJobMarketDisclosureMessage,
  [SkillsRankingPhase.JOB_SEEKER_DISCLOSURE]: createJobSeekerDisclosureMessage,
  [SkillsRankingPhase.PERCEIVED_RANK]: createPerceivedRankMessage,
  [SkillsRankingPhase.RETYPED_RANK]: createRetypedRankMessage,
  [SkillsRankingPhase.COMPLETED]: null,
  [SkillsRankingPhase.CANCELLED]: null,
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
      return await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.INITIAL
      );
    } catch (error) {
      console.error(new SkillsRankingError("Error initializing skills ranking state:", error));
      return null;
    }
  };

  const getPathToPhase = (phase: SkillsRankingPhase): SkillsRankingPhase[] => {
    const path = skillsRankingSadPath.includes(phase)
      ? skillsRankingSadPath
      : skillsRankingHappyPath;
    const index = path.indexOf(phase);
    return path.slice(0, index + 1);
  };

  const handleFlow = (currentPhase: SkillsRankingPhase, onFinishFlow: () => void) => async (
    newState: SkillsRankingState
  ) => {
    if (
      newState.phase === SkillsRankingPhase.CANCELLED ||
      newState.phase === SkillsRankingPhase.COMPLETED
    ) {
      onFinishFlow();
      return;
    }

    const path = getPathToPhase(newState.phase);
    const currentIndex = path.indexOf(currentPhase);
    const nextPhase = path[currentIndex + 1];
    const factory = phaseToMessageFactory[nextPhase];

    if (process.env.NODE_ENV === "development") {
      console.debug(`Transitioning from ${currentPhase} to ${nextPhase}`);
    }

    if (!factory && nextPhase) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`No message factory found for phase: ${nextPhase}`);
      }
      return;
    }

    if (nextPhase && factory) {
      const nextMessages = factory(newState, handleFlow(nextPhase, onFinishFlow));
      (Array.isArray(nextMessages) ? nextMessages : [nextMessages]).forEach(addMessage);
    }
  };

  const showSkillsRanking = async (onFinishFlow: () => void) => {
    let state = await getSkillsRankingState();
    state ??= await initializeSkillsRankingState();

    if (!state) {
      console.error(new SkillsRankingError("Skills ranking state is still null after initialization."));
      onFinishFlow();
      return;
    }

    const path = getPathToPhase(state.phase);

    for (const phase of path) {
      if (state.phase !== phase) {
        break;
      }

      const factory = phaseToMessageFactory[phase];
      if (!factory) continue;

      const messages = factory(state, handleFlow(phase, onFinishFlow));
      (Array.isArray(messages) ? messages : [messages]).forEach(addMessage);
    }

    if (
      state.phase === SkillsRankingPhase.CANCELLED ||
      state.phase === SkillsRankingPhase.COMPLETED
    ) {
      onFinishFlow();
    }
  };

  return { showSkillsRanking };
};
