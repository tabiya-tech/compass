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
    const index = skillsRankingHappyPath.indexOf(phase);
    if (index === -1) {
      console.warn(`[SkillsRanking] Phase '${phase}' not found in path`, skillsRankingHappyPath);
      return [];
    }
    return skillsRankingHappyPath.slice(0, index + 1);
  };

  const handleFlow =
    (currentPhase: SkillsRankingPhase, onFinishFlow: () => void) =>
      async (newState: SkillsRankingState) => {
        const currentPhaseName = newState.phase[newState.phase.length - 1]?.name;
        if (currentPhaseName === SkillsRankingPhase.COMPLETED) {
          console.debug(`[Flow] Final phase '${currentPhaseName}' reached`);
          onFinishFlow();
          return;
        }

        const currentIndex = skillsRankingHappyPath.indexOf(currentPhase);
        const nextPhase = skillsRankingHappyPath[currentIndex + 1];
        const factory = phaseToMessageFactory[nextPhase];

        console.debug(
          `[Flow] going from '${currentPhase}' to '${nextPhase}' along path: ${skillsRankingHappyPath.join(
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

    const currentPhaseName = state.phase[state.phase.length - 1]?.name;
    const path = getPathToPhase(currentPhaseName);
    if (path.length === 0) {
      console.warn(`[Flow] Invalid phase path for phase: '${currentPhaseName}'`);
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

    if (currentPhaseName === SkillsRankingPhase.COMPLETED) {
      console.debug(`[Flow] Already completed`);
      onFinishFlow();
    }
  };

  return { showSkillsRanking };
};
