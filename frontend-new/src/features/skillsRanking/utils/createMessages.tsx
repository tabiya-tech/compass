import React from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

import SkillsRankingBriefing, {
  SKILLS_RANKING_BRIEFING_MESSAGE_ID,
  SkillsRankingBriefingProps,
} from "src/features/skillsRanking/components/skillsRankingBriefing/SkillsRankingBriefing";
import SkillsRankingDisclosure, {
  SKILLS_RANKING_DISCLOSURE_MESSAGE_ID,
  SkillsRankingDisclosureProps,
} from "src/features/skillsRanking/components/skillsRankingDisclosure/SkillsRankingDisclosure";
import SkillsRankingPrompt, {
  SKILLS_RANKING_PROMPT_MESSAGE_ID,
  SkillsRankingPromptProps,
} from "src/features/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import SkillsRankingRetypedRank, {
  SKILLS_RANKING_RETYPED_RANK_MESSAGE_ID,
  SkillsRankingRetypedRankProps,
} from "src/features/skillsRanking/components/skillsRankingRetypedRank/SkillsRankingRetypedRank";
import SkillsRankingPerceivedRank, {
  SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID,
  SkillsRankingPerceivedRankProps,
} from "src/features/skillsRanking/components/skillsRankingPerceivedRank/SkillsRankingPerceivedRank";
import SkillsRankingProofOfValue, {
  SKILLS_RANKING_EFFORT_MESSAGE_ID,
  SkillsRankingEffortProps,
} from "src/features/skillsRanking/components/skillsRankingProofOfValue/SkillsRankingProofOfValue";
import SkillsRankingCompletionAdvice, {
  SKILLS_RANKING_COMPLETION_ADVICE_MESSAGE_ID,
  SkillsRankingCompletionAdviceProps,
} from "src/features/skillsRanking/components/skillsRankingCompletionAdvice/SkillsRankingCompletionAdvice";
import SkillsRankingPriorBelief, {
  SKILLS_RANKING_PRIOR_BELIEF_MESSAGE_ID, SkillsRankingPriorBeliefProps,
} from "src/features/skillsRanking/components/skillsRankingPriorBelief/SkillsRankingPriorBelief";
import SkillsRankingPriorBeliefForSkill, {
  SKILLS_RANKING_PRIOR_BELIEF_FOR_SKIll_MESSAGE_ID, SkillsRankingPriorBeliefForSkillProps,
} from "src/features/skillsRanking/components/skillsRankingPriorBeliefForSkill/SkillsRankingPriorBeliefForSkill";
import ProofOfValueIntro, {
  PROOF_OF_VALUE_INTRO_MESSAGE_ID,
  ProofOfValueIntroProps,
} from "src/features/skillsRanking/components/skillsRankingProofOfValueIntro/SkillsRankingProofOfValueIntro";
import SkillsRankingApplicationMotivation, {
  SkillsRankingApplicationMotivationProps,
} from "src/features/skillsRanking/components/skillsRankingApplicationMotivation/SkillsRankingApplicationMotivation";
import SkillsRankingApplication24h, {
  SkillsRankingApplication24hProps,
} from "src/features/skillsRanking/components/skillsRankingApplication24h/SkillsRankingApplication24h";
import SkillsRankingPerceivedRankForSkill, {
  SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_MESSAGE_ID,
  Props as SkillsRankingPerceivedRankForSkillProps,
} from "src/features/skillsRanking/components/skillsRankingPerceivedRankForSkill/SkillsRankingPerceivedRankForSkill";
import SkillsRankingOpportunitySkillRequirement, {
  SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_MESSAGE_ID,
  Props as SkillsRankingOpportunitySkillRequirementProps,
} from "src/features/skillsRanking/components/skillsRankingOpportunitySkillRequirement/SkillsRankingOpportunitySkillRequirement";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingState,
  SkillsRankingPhase,
  getLatestPhaseName,
} from "src/features/skillsRanking/types";
import { getNextPhaseForGroup } from "src/features/skillsRanking/hooks/skillsRankingFlowGraph";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";

// Utility function to check if a group should skip market disclosure (and consequently retyped rank)
// TODO: remove this utility (not useful anymoree)
export const shouldSkipMarketDisclosure = (experimentGroup: SkillsRankingExperimentGroups): boolean => {
  return experimentGroup === SkillsRankingExperimentGroups.GROUP_2;
};

export const createBriefingMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingBriefingProps> => ({
  message_id: SKILLS_RANKING_BRIEFING_MESSAGE_ID,
  type: SKILLS_RANKING_BRIEFING_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingBriefingProps) => React.createElement(SkillsRankingBriefing, props),
});

export const createDisclosureMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingDisclosureProps> => ({
  message_id: SKILLS_RANKING_DISCLOSURE_MESSAGE_ID,
  type: SKILLS_RANKING_DISCLOSURE_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingDisclosureProps) =>
    React.createElement(SkillsRankingDisclosure, props),
});

export const createPromptMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingPromptProps> => ({
  message_id: SKILLS_RANKING_PROMPT_MESSAGE_ID,
  type: SKILLS_RANKING_PROMPT_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingPromptProps) => React.createElement(SkillsRankingPrompt, props),
});

export const createRetypedRankMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingRetypedRankProps> | null => {
  // Check if the component should be shown based on experiment group
  const shouldNotShow = shouldSkipMarketDisclosure(skillsRankingState.metadata.experiment_group);

  // If the component should not be shown, don't create a message
  if (shouldNotShow) {
    return null;
  }

  return {
    message_id: SKILLS_RANKING_RETYPED_RANK_MESSAGE_ID,
    type: SKILLS_RANKING_RETYPED_RANK_MESSAGE_ID,
    payload: {
      skillsRankingState,
      onFinish,
    },
    sender: ConversationMessageSender.COMPASS,
    component: (props: SkillsRankingRetypedRankProps) => React.createElement(SkillsRankingRetypedRank, props),
  };
};

export const createPerceivedRankMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingPerceivedRankProps> => {
  const currentPhaseName = getLatestPhaseName(skillsRankingState);
  const currentPhase = skillsRankingState.phase[skillsRankingState.phase.length - 1];
  const existingResponse = skillsRankingState.user_responses.perceived_rank_percentile;
  const isReplay = currentPhaseName !== SkillsRankingPhase.PERCEIVED_RANK;

  const handleSubmit = async (value: number) => {
    const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!activeSessionId) {
      console.error(new SkillsRankingError("Active session ID is not available."));
      return;
    }

    try {
      const nextPhase = getNextPhaseForGroup(
        skillsRankingState.metadata.experiment_group,
        SkillsRankingPhase.PERCEIVED_RANK
      );
      if (!nextPhase) {
        console.error(new SkillsRankingError("No next phase found for PERCEIVED_RANK"));
        return;
      }

      const updatedState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        nextPhase,
        { perceived_rank_percentile: value }
      );

      await onFinish(updatedState);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
    }
  };

  return {
  message_id: SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID,
  type: SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID,
  payload: {
      isReadOnly: isReplay,
      mostDemandedLabel: skillsRankingState.score.most_demanded_label,
      sentAt: currentPhase?.time || skillsRankingState.metadata.started_at,
      onSubmit: handleSubmit,
      defaultValue: existingResponse,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingPerceivedRankProps) => React.createElement(SkillsRankingPerceivedRank, props),
  };
};

export const createEffortMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingEffortProps> => ({
  message_id: SKILLS_RANKING_EFFORT_MESSAGE_ID,
  type: SKILLS_RANKING_EFFORT_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingEffortProps) => React.createElement(SkillsRankingProofOfValue, props),
});

export const createPriorBeliefMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingPriorBeliefProps> => ({
  message_id: SKILLS_RANKING_PRIOR_BELIEF_MESSAGE_ID,
  type: SKILLS_RANKING_PRIOR_BELIEF_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingPriorBeliefProps) => React.createElement(SkillsRankingPriorBelief, props),
  });

export const createPriorBeliefForSkillMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingPriorBeliefForSkillProps> => ({
  message_id: SKILLS_RANKING_PRIOR_BELIEF_FOR_SKIll_MESSAGE_ID,
  type: SKILLS_RANKING_PRIOR_BELIEF_FOR_SKIll_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingPriorBeliefForSkillProps) => React.createElement(SkillsRankingPriorBeliefForSkill, props),
});

export const createProofOfValueIntroMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<ProofOfValueIntroProps> => ({
  message_id: PROOF_OF_VALUE_INTRO_MESSAGE_ID,
  type: PROOF_OF_VALUE_INTRO_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: ProofOfValueIntroProps) => React.createElement(ProofOfValueIntro, props),
});

const APPLICATION_MOTIVATION_MESSAGE_ID = "skills-ranking-application-motivation-message";

export const createApplicationMotivationMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingApplicationMotivationProps> => {
  const handleFinish = async (stateWithResponse: SkillsRankingState) => {
    const response = stateWithResponse.user_responses.application_willingness;
    if (!response) {
      console.warn("[SkillsRanking] Missing application_willingness response");
      return;
    }

    const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!activeSessionId) {
      console.error(new SkillsRankingError("Active session ID is not available."));
      return;
    }

    try {
      const nextPhase = getNextPhaseForGroup(
        stateWithResponse.metadata.experiment_group,
        SkillsRankingPhase.APPLICATION_WILLINGNESS
      );
      if (!nextPhase) {
        console.error(new SkillsRankingError("No next phase found for APPLICATION_WILLINGNESS"));
        return;
      }

      const updatedState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        nextPhase,
        { application_willingness: response }
      );
      await onFinish(updatedState);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
    }
  };

  return {
    message_id: APPLICATION_MOTIVATION_MESSAGE_ID,
    type: APPLICATION_MOTIVATION_MESSAGE_ID,
    payload: {
      skillsRankingState,
      onFinish: handleFinish,
    },
    sender: ConversationMessageSender.COMPASS,
    component: (props: SkillsRankingApplicationMotivationProps) =>
      React.createElement(SkillsRankingApplicationMotivation, props),
  };
};

const APPLICATION_24H_MESSAGE_ID = "skills-ranking-application-24h-message";

export const createApplication24hMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingApplication24hProps> => {
  const handleFinish = async (stateWithResponse: SkillsRankingState) => {
    const response = stateWithResponse.user_responses.application_24h;
    if (response === undefined) {
      console.warn("[SkillsRanking] Missing application_24h response");
      return;
    }

    const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!activeSessionId) {
      console.error(new SkillsRankingError("Active session ID is not available."));
      return;
    }

    try {
      const nextPhase = getNextPhaseForGroup(
        stateWithResponse.metadata.experiment_group,
        SkillsRankingPhase.APPLICATION_24H
      );
      if (!nextPhase) {
        console.error(new SkillsRankingError("No next phase found for APPLICATION_24H"));
        return;
      }

      const updatedState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        nextPhase,
        { application_24h: response }
      );
      await onFinish(updatedState);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
    }
  };

  return {
    message_id: APPLICATION_24H_MESSAGE_ID,
    type: APPLICATION_24H_MESSAGE_ID,
    payload: {
      skillsRankingState,
      onFinish: handleFinish,
    },
    sender: ConversationMessageSender.COMPASS,
    component: (props: SkillsRankingApplication24hProps) => React.createElement(SkillsRankingApplication24h, props),
  };
};

export const createCompletionAdviceMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingCompletionAdviceProps> | null => {
  // Check if the component should be shown based on experiment group
  const shouldNotShow = shouldSkipMarketDisclosure(skillsRankingState.metadata.experiment_group);

  // If the component should not be shown, don't create a message
  if (shouldNotShow) {
    return null;
  }

  return {
    message_id: SKILLS_RANKING_COMPLETION_ADVICE_MESSAGE_ID,
    type: SKILLS_RANKING_COMPLETION_ADVICE_MESSAGE_ID,
    payload: {
      skillsRankingState,
      onFinish,
    },
    sender: ConversationMessageSender.COMPASS,
    component: (props: SkillsRankingCompletionAdviceProps) => React.createElement(SkillsRankingCompletionAdvice, props),
  };
};

export const createOpportunitySkillRequirementMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingOpportunitySkillRequirementProps> => {
  const currentPhaseName = getLatestPhaseName(skillsRankingState);
  const currentPhase = skillsRankingState.phase[skillsRankingState.phase.length - 1];
  const existingResponse = skillsRankingState.user_responses.opportunity_skill_requirement_percentile;
  const isReadOnly = currentPhaseName !== SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT;

  const handleSubmit = async (value: number) => {
    const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!activeSessionId) {
      console.error(new SkillsRankingError("Active session ID is not available."));
      return;
    }

    try {
      const nextPhase = getNextPhaseForGroup(
        skillsRankingState.metadata.experiment_group,
        SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT
      );

      if (!nextPhase) {
      console.error(new SkillsRankingError("No next phase found for OPPORTUNITY_SKILL_REQUIREMENT"));
        return;
      }

      const updatedState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        nextPhase,
        { opportunity_skill_requirement: value }
      );

      await onFinish(updatedState);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
    }
  };

  return {
    message_id: SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_MESSAGE_ID,
    type: SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_MESSAGE_ID,
    payload: {
      isReadOnly,
      mostDemandedLabel: skillsRankingState.score.most_demanded_label,
      sentAt: currentPhase?.time || skillsRankingState.metadata.started_at,
      onSubmit: handleSubmit,
      defaultValue: existingResponse,
    },
    sender: ConversationMessageSender.COMPASS,
    component: (props: SkillsRankingOpportunitySkillRequirementProps) =>
      React.createElement(SkillsRankingOpportunitySkillRequirement, props),
  };
};

export const createPerceivedRankForSkillMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingPerceivedRankForSkillProps> => {
  const currentPhaseName = getLatestPhaseName(skillsRankingState);
  const currentPhase = skillsRankingState.phase[skillsRankingState.phase.length - 1];
  const existingResponse = skillsRankingState.user_responses.perceived_rank_for_skill_percentile;
  const isReplay = currentPhaseName !== SkillsRankingPhase.PERCEIVED_RANK_FOR_SKILL;

  const handleSubmit = async (value: number) => {
    const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!activeSessionId) {
      console.error(new SkillsRankingError("Active session ID is not available."));
      return;
    }

    try {
      const nextPhase = getNextPhaseForGroup(
        skillsRankingState.metadata.experiment_group,
        SkillsRankingPhase.PERCEIVED_RANK_FOR_SKILL
      );
      if (!nextPhase) {
        console.error(new SkillsRankingError("No next phase found for PERCEIVED_RANK_FOR_SKILL"));
        return;
      }

      const updatedState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        nextPhase,
        { perceived_rank_for_skill: value }
      );

      await onFinish(updatedState);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
    }
  };

  return {
    message_id: SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_MESSAGE_ID,
    type: SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_MESSAGE_ID,
    payload: {
      isReadOnly: isReplay,
      leastDemandedLabel: skillsRankingState.score.least_demanded_label,
      sentAt: currentPhase?.time || skillsRankingState.metadata.started_at,
      onSubmit: handleSubmit,
      defaultValue: existingResponse,
    },
    sender: ConversationMessageSender.COMPASS,
    component: (props: SkillsRankingPerceivedRankForSkillProps) => React.createElement(SkillsRankingPerceivedRankForSkill, props),
  };
};
