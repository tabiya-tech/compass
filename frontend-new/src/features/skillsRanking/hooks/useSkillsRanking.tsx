import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IChatMessage } from "src/chat/Chat.types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { SessionError } from "src/error/commonErrors";
import {
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
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
  const activeSessionId =
    UserPreferencesStateService.getInstance().getActiveSessionId();

  const getSkillsRankingState = async (): Promise<SkillsRankingState | null> => {
    if (!activeSessionId)
      throw new SessionError("Active session ID is not available.");
    try {
      return await SkillsRankingService.getInstance().getSkillsRankingState(
        activeSessionId
      );
    } catch (error) {
      console.error(
        new SkillsRankingError("Error fetching skills ranking state:", error)
      );
      return null;
    }
  };

  const initializeSkillsRankingState =
    async (): Promise<SkillsRankingState | null> => {
      if (!activeSessionId)
        throw new SessionError("Active session ID is not available.");
      try {
        return await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          SkillsRankingPhase.INITIAL
        );
      } catch (error) {
        console.error(
          new SkillsRankingError("Error initializing skills ranking state:", error)
        );
        return null;
      }
    };

  const getPathToPhase = (phase: SkillsRankingPhase): SkillsRankingPhase[] => {
    const path = skillsRankingSadPath.includes(phase)
      ? skillsRankingSadPath
      : skillsRankingHappyPath;
    const index = path.indexOf(phase);
    if (index === -1) {
      console.warn(`[SkillsRanking] Phase '${phase}' not found in path`, path);
      return [];
    }
    return path.slice(0, index + 1);
  };

  const handleFlow =
    (currentPhase: SkillsRankingPhase, onFinishFlow: () => void) =>
      async (newState: SkillsRankingState) => {
        if (
          newState.phase === SkillsRankingPhase.CANCELLED ||
          newState.phase === SkillsRankingPhase.COMPLETED
        ) {
          console.debug(`[Flow] Final phase '${newState.phase}' reached`);
          onFinishFlow();
          return;
        }

        const fullPath = skillsRankingSadPath.includes(newState.phase)
          ? skillsRankingSadPath
          : skillsRankingHappyPath;

        const currentIndex = fullPath.indexOf(currentPhase);
        const nextPhase = fullPath[currentIndex + 1];
        const factory = phaseToMessageFactory[nextPhase];

        console.debug(
          `[Flow] going from '${currentPhase}' to '${nextPhase}' along path: ${fullPath.join(
            " → "
          )}`
        );

        if (!nextPhase || !factory) {
          console.debug(`[Flow] No next phase or factory found. Ending flow.`);
          onFinishFlow();
          return;
        }

        const result = factory(newState, handleFlow(nextPhase, onFinishFlow));
        (Array.isArray(result) ? result : [result]).forEach(addMessage);
      };


  const showSkillsRanking = async (onFinishFlow: () => void) => {
    let state = await getSkillsRankingState();
    state ??= await initializeSkillsRankingState();

    if (!state) {
      console.error(
        new SkillsRankingError(
          "Skills ranking state is still null after initialization."
        )
      );
      onFinishFlow();
      return;
    }

    const path = getPathToPhase(state.phase);
    if (path.length === 0) {
      console.warn(`[Flow] Invalid phase path for phase: '${state.phase}'`);
      onFinishFlow();
      return;
    }

    console.debug(`[Flow] Replaying path: ${path.join(" → ")}`);

    path.forEach((phase) => {
      const factory = phaseToMessageFactory[phase];
      if (factory) {
        const result = factory(state, handleFlow(phase, onFinishFlow));
        (Array.isArray(result) ? result : [result]).forEach(addMessage);
      }
    });

    if (
      state.phase === SkillsRankingPhase.CANCELLED ||
      state.phase === SkillsRankingPhase.COMPLETED
    ) {
      console.debug(`[Flow] Already completed or cancelled`);
      onFinishFlow();
    }
  };

  return { showSkillsRanking };
};
