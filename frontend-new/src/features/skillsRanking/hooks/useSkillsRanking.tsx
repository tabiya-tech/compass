import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { IChatMessage } from "src/chat/Chat.types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { SessionError } from "src/error/commonErrors";
import {
  getLatestPhaseName,
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { getFlowPathForGroup } from "./skillsRankingFlowGraph";
import {
  createApplication24hMessage,
  createApplicationMotivationMessage,
  createBriefingMessage,
  createDisclosureMessage,
  createEffortMessage,
  createOpportunitySkillRequirementMessage,
  createPerceivedRankForSkillMessage,
  createPerceivedRankMessage,
  createPriorBeliefForSkillMessage,
  createPriorBeliefMessage,
  createPromptMessage,
  createProofOfValueIntroMessage,
} from "src/features/skillsRanking/utils/createMessages";

const phaseToMessageFactory: Partial<Record<SkillsRankingPhase, (...args: any[]) => IChatMessage<any>>> = {
  [SkillsRankingPhase.INITIAL]: createPromptMessage,
  [SkillsRankingPhase.BRIEFING]: createBriefingMessage,
  [SkillsRankingPhase.PROOF_OF_VALUE_INTRO]: createProofOfValueIntroMessage,
  [SkillsRankingPhase.PROOF_OF_VALUE]: createEffortMessage,
  [SkillsRankingPhase.PRIOR_BELIEF]: createPriorBeliefMessage,
  [SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL]: createPriorBeliefForSkillMessage,
  [SkillsRankingPhase.APPLICATION_WILLINGNESS]: createApplicationMotivationMessage,
  [SkillsRankingPhase.APPLICATION_24H]: createApplication24hMessage,
  [SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT]: createOpportunitySkillRequirementMessage,
  [SkillsRankingPhase.DISCLOSURE]: createDisclosureMessage,
  [SkillsRankingPhase.PERCEIVED_RANK]: createPerceivedRankMessage,
  [SkillsRankingPhase.PERCEIVED_RANK_FOR_SKILL]: createPerceivedRankForSkillMessage,
};

const getPathToPhase = (
  phase: SkillsRankingPhase,
  experimentGroup?: SkillsRankingExperimentGroups,
): SkillsRankingPhase[] => {
  const fallbackGroup = SkillsRankingExperimentGroups.GROUP_1;
  if (!experimentGroup) {
    experimentGroup = fallbackGroup;
  }

  const flowPath = getFlowPathForGroup(experimentGroup);
  const currentPhaseIndex = flowPath.indexOf(phase);

  if (currentPhaseIndex === -1) {
    console.warn(`[SkillsRanking] Phase '${phase}' not found in path ${flowPath} for group: ${experimentGroup}`);
    return [];
  }

  // Return the path up to and including the current phase
  return flowPath.slice(0, currentPhaseIndex + 1);
};

/**
 * Fetches the current state for the active session.
 * From the backend service.
 */
const getSkillsRankingState = async (): Promise<SkillsRankingState | null> => {
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

  if (!activeSessionId)
    throw new SessionError("Active session ID is not available.");

  try {
    return await SkillsRankingService.getInstance().getSkillsRankingState(activeSessionId);
  } catch (error) {
    console.error(new SkillsRankingError("Error fetching skills ranking state:", error));
    return null;
  }
};

const initializeSkillsRankingState = async (): Promise<SkillsRankingState | null> => {
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

  if (!activeSessionId)
    throw new SessionError("Active session ID is not available.");

  try {
    return await SkillsRankingService.getInstance().updateSkillsRankingState(
      activeSessionId,
      SkillsRankingPhase.INITIAL,
    );
  } catch (error) {
    console.error(new SkillsRankingError("Error initializing skills ranking state:", error));
    return null;
  }
};

export const useSkillsRanking = (
  addMessage: (message: IChatMessage<any>) => void,
  removeMessage: (messageId: string) => void,
) => {
  const getNextPhaseHandler =
    (currentPhase: SkillsRankingPhase, onFinishFlow: () => void) => async (newState: SkillsRankingState) => {
      const currentPhaseName = getLatestPhaseName(newState);

      if (!currentPhaseName) {
        console.warn(`[Flow] No current phase found in state`);
        onFinishFlow();
        return;
      }

      if (currentPhaseName === SkillsRankingPhase.COMPLETED) {
        console.debug(`[Flow] Final phase '${currentPhaseName}' reached`);
        onFinishFlow();
        return;
      }

      // Components advance the state before calling onFinish, so currentPhaseName is the phase we transitioned to.
      // If currentPhaseName is different from currentPhase, we've transitioned and should show currentPhaseName.
      // Otherwise, find the next phase after currentPhase.
      const flowPath = getFlowPathForGroup(newState.metadata.experiment_group);
      let phaseToShow: SkillsRankingPhase | undefined;

      if (currentPhaseName === currentPhase) {
        // Still in the same phase, find the next one
        const currentIndex = flowPath.indexOf(currentPhase);
        phaseToShow = flowPath[currentIndex + 1];
      } else {
        // We've transitioned to a new phase, show that phase
        phaseToShow = currentPhaseName;
      }

      if (!phaseToShow) {
        console.debug(`[Flow] No next phase Ending flow.`);
        onFinishFlow();
        return;
      }

      const factory = phaseToMessageFactory[phaseToShow];
      if (!factory) {
        console.debug(`[Flow] No factory to generate a message`);
        onFinishFlow();
        return;
      }

      console.debug(
        `[Flow] going from '${currentPhase}' to '${phaseToShow}' (currentPhaseName: ${currentPhaseName}) for group ${newState.metadata.experiment_group} using path: ${flowPath.join(" → ")}`,
      );

      const message = factory(newState, getNextPhaseHandler(phaseToShow, onFinishFlow));
      addMessage(message);
    };

  const showSkillsRanking = async (onFinishFlow: () => void) => {
    // Fetch the current available state.
    let state = await getSkillsRankingState();

    // If the state is null, initialize it.
    state ??= await initializeSkillsRankingState();

    if (!state) {
      console.error(new SkillsRankingError("Skills ranking state is still null after initialization."));
      onFinishFlow();
      return;
    }

    const currentPhaseName = getLatestPhaseName(state);
    if (!currentPhaseName) {
      console.error(`[Flow] No or invalid current phase found in state: `, state);
      onFinishFlow();
      return;
    }

    const path = getPathToPhase(currentPhaseName, state.metadata.experiment_group);
    if (path.length === 0) {
      console.warn(`[Flow] Invalid phase path for phase: '${currentPhaseName}'`);
      onFinishFlow();
      return;
    }

    console.debug(`[Flow] Replaying path: ${path.join(" → ")}`);

    path.forEach((phase) => {
      if (phase === SkillsRankingPhase.COMPLETED) {
        console.debug(`[Flow] Final phase '${phase}' reached during replay`);
        onFinishFlow();
        return;
      }

      const factory = phaseToMessageFactory[phase];
      if (factory) {
        // Get the component that is to be shown for this phase.
        // Add the message to the message history.
        const message = factory(state, getNextPhaseHandler(phase, onFinishFlow));
        addMessage(message);
      } else {
        console.error(new SkillsRankingError(`[Flow] No factory found for phase: ${phase} Skipping phase.`));
      }
    });
  };

  return { showSkillsRanking };
};
