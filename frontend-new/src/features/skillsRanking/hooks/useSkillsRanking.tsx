import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IChatMessage } from "src/chat/Chat.types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { SessionError } from "src/error/commonErrors";
import {
  SkillsRankingPhase,
  SkillsRankingState,
  getLatestPhaseName,
  SkillsRankingExperimentGroups,
} from "src/features/skillsRanking/types";
import { getFlowPathForGroup, skillsRankingHappyPathFull } from "./skillsRankingFlowGraph";
import {
  createBriefingMessage,
  createCompletionAdviceMessage,
  createEffortMessage,
  createJobMarketDisclosureMessage,
  createJobSeekerDisclosureMessage,
  createPerceivedRankMessage,
  createPromptMessage,
  createRetypedRankMessage,
  shouldSkipMarketDisclosure,
} from "src/features/skillsRanking/utils/createMessages";

const phaseToMessageFactory = {
  [SkillsRankingPhase.INITIAL]: createPromptMessage,
  [SkillsRankingPhase.BRIEFING]: createBriefingMessage,
  [SkillsRankingPhase.PROOF_OF_VALUE]: createEffortMessage,
  [SkillsRankingPhase.MARKET_DISCLOSURE]: createJobMarketDisclosureMessage,
  [SkillsRankingPhase.JOB_SEEKER_DISCLOSURE]: createJobSeekerDisclosureMessage,
  [SkillsRankingPhase.PERCEIVED_RANK]: createPerceivedRankMessage,
  [SkillsRankingPhase.RETYPED_RANK]: createRetypedRankMessage,
  [SkillsRankingPhase.COMPLETED]: createCompletionAdviceMessage,
};

const getPathToPhase = (
  phase: SkillsRankingPhase,
  experimentGroup?: SkillsRankingExperimentGroups
): SkillsRankingPhase[] => {
  // Use the full path as default if no experiment group is provided
  const flowPath = experimentGroup ? getFlowPathForGroup(experimentGroup) : skillsRankingHappyPathFull;
  const index = flowPath.indexOf(phase);
  if (index === -1) {
    console.warn(`[SkillsRanking] Phase '${phase}' not found in path`, flowPath);
    return [];
  }
  return flowPath.slice(0, index + 1);
};

const getSkillsRankingState = async (): Promise<SkillsRankingState | null> => {
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

  if (!activeSessionId) throw new SessionError("Active session ID is not available.");
  try {
    return await SkillsRankingService.getInstance().getSkillsRankingState(activeSessionId);
  } catch (error) {
    console.error(new SkillsRankingError("Error fetching skills ranking state:", error));
    return null;
  }
};

const initializeSkillsRankingState = async (): Promise<SkillsRankingState | null> => {
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

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

export const useSkillsRanking = (
  addMessage: (message: IChatMessage<any>) => void,
  removeMessage: (messageId: string) => void
) => {
  /**
   * Handles the flow transition between skills ranking phases.
   * Determines the next phase in the flow and creates the appropriate message.
   * @param currentPhase - The current phase in the skills ranking flow
   * @param onFinishFlow - Callback to execute when the flow is complete
   * @returns A function that handles the state transition
   */
  const getNextPhaseHandler =
    (currentPhase: SkillsRankingPhase, onFinishFlow: () => void) => async (newState: SkillsRankingState) => {
      const currentPhaseName = getLatestPhaseName(newState);

      if (currentPhaseName === SkillsRankingPhase.COMPLETED) {
        console.debug(`[Flow] Final phase '${currentPhaseName}' reached`);

        // Check if we should show completion advice based on experiment group
        const shouldShowAdvice = !shouldSkipMarketDisclosure(newState.experiment_group);
        if (shouldShowAdvice) {
          console.debug(`[Flow] Showing completion advice for group ${newState.experiment_group}`);
          const factory = phaseToMessageFactory[SkillsRankingPhase.COMPLETED];
          if (factory) {
            const result = factory(newState, async (skillsRankingState: SkillsRankingState) => {
              console.debug(`[Flow] Completion advice finished, calling onFinishFlow`);
              onFinishFlow();
            });
            (Array.isArray(result) ? result : [result]).filter((message) => message !== null).forEach(addMessage);
          }
        } else {
          console.debug(
            `[Flow] Skipping completion advice for group ${newState.experiment_group}, calling onFinishFlow directly`
          );
          onFinishFlow();
        }
        return;
      }
      // Get the correct flow path for this experiment group
      const flowPath = getFlowPathForGroup(newState.experiment_group);
      const currentIndex = flowPath.indexOf(currentPhase);
      const nextPhase = flowPath[currentIndex + 1];
      const factory = phaseToMessageFactory[nextPhase];

      console.debug(
        `[Flow] going from '${currentPhase}' to '${nextPhase}' for group ${newState.experiment_group} using path: ${flowPath.join(" → ")}`
      );

      if (!nextPhase || !factory) {
        console.debug(`[Flow] No next phase or factory found. Ending flow.`);
        onFinishFlow();
        return;
      }

      const result = factory(newState, getNextPhaseHandler(nextPhase, onFinishFlow));
      (Array.isArray(result) ? result : [result]).filter((message) => message !== null).forEach(addMessage);
    };

  const showSkillsRanking = async (onFinishFlow: () => void) => {
    let state = await getSkillsRankingState();

    state ??= await initializeSkillsRankingState();

    if (!state) {
      console.error(new SkillsRankingError("Skills ranking state is still null after initialization."));
      onFinishFlow();
      return;
    }

    const currentPhaseName = getLatestPhaseName(state);
    if (!currentPhaseName) {
      console.warn(`[Flow] No current phase found in state`);
      onFinishFlow();
      return;
    }

    const path = getPathToPhase(currentPhaseName, state.experiment_group);
    if (path.length === 0) {
      console.warn(`[Flow] Invalid phase path for phase: '${currentPhaseName}'`);
      onFinishFlow();
      return;
    }

    console.debug(`[Flow] Replaying path: ${path.join(" → ")}`);

    path.forEach((phase) => {
      const factory = phaseToMessageFactory[phase];

      if (phase === SkillsRankingPhase.COMPLETED) {
        // Check if we should show completion advice based on experiment group
        const shouldShowAdvice = !shouldSkipMarketDisclosure(state.experiment_group);
        if (!shouldShowAdvice) {
          console.debug(`[Flow] Skipping completion advice for phase: ${phase} in group: ${state.experiment_group}`);
          onFinishFlow();
          return;
        }
        console.debug(`[Flow] Showing completion advice for phase: ${phase} in group: ${state.experiment_group}`);
        const result = factory(state, async (skillsRankingState: SkillsRankingState) => {
          console.debug(`[Flow] Completion advice finished during replay, calling onFinishFlow`);
          onFinishFlow();
        });
        (Array.isArray(result) ? result : [result]).filter((message) => message !== null).forEach(addMessage);
        return;
      }
      if (factory) {
        const result = factory(state, getNextPhaseHandler(phase, onFinishFlow));
        (Array.isArray(result) ? result : [result]).filter((message) => message !== null).forEach(addMessage);
      }
    });
  };

  return { showSkillsRanking };
};
