import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IChatMessage } from "src/chat/Chat.types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { SessionError } from "src/error/commonErrors";
import { SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import { skillsRankingHappyPath } from "./skillsRankingFlowGraph";
import {
  createBriefingMessage,
  createEffortMessage,
  createJobMarketDisclosureMessage,
  createJobSeekerDisclosureMessage,
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

const getPathToPhase = (phase: SkillsRankingPhase): SkillsRankingPhase[] => {
  const index = skillsRankingHappyPath.indexOf(phase);
  if (index === -1) {
    console.warn(`[SkillsRanking] Phase '${phase}' not found in path`, skillsRankingHappyPath);
    return [];
  }
  return skillsRankingHappyPath.slice(0, index + 1);
};


const getSkillsRankingState = async (): Promise<SkillsRankingState | null> => {
  const activeSessionId =
    UserPreferencesStateService.getInstance().getActiveSessionId();

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
    const activeSessionId =
      UserPreferencesStateService.getInstance().getActiveSessionId();

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


export const useSkillsRanking = (
  addMessage: (message: IChatMessage<any>) => void,
  removeMessage: (messageId: string) => void,
) => {

  // REVIEW: Move this function outside of this hook, if possible in the utils function.
  // Why it re-compile it if the useSKillsRanking is called multiple times?
  // const getPathToPhase = (phase: SkillsRankingPhase): SkillsRankingPhase[] => {
  //   const index = skillsRankingHappyPath.indexOf(phase);
  //   if (index === -1) {
  //     console.warn(`[SkillsRanking] Phase '${phase}' not found in path`, skillsRankingHappyPath);
  //     return [];
  //   }
  //   return skillsRankingHappyPath.slice(0, index + 1);
  // };

  /**
   * REVIEW: Document what this function does.
   * rename to: getNextFunction
   * @param currentPhase
   * @param onFinishFlow
   */
  const handleFlow =
    (currentPhase: SkillsRankingPhase, onFinishFlow: () => void) => async (newState: SkillsRankingState) => {
        // REVIEW: a function called getRecentPhase perhaps on
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

    // REVIEW: What if state.phase is Empty or undefined?
    //         I see the last phase is the current phase.
    const currentPhaseName = state.phase[state.phase.length - 1]?.name;
    // REVIEW: We can add a guard to call isValidPhaseName

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
