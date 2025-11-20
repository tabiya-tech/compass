import React from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

import SkillsRankingBriefing, {
  SKILLS_RANKING_BRIEFING_MESSAGE_ID,
  SkillsRankingBriefingProps,
} from "src/features/skillsRanking/components/skillsRankingBriefing/SkillsRankingBriefing";
import SkillsRankingJobSeekerDisclosure, {
  SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_MESSAGE_ID,
  SkillsRankingJobSeekerDisclosureProps,
} from "src/features/skillsRanking/components/skillsRankingDisclosure/skillsRankingJobSeekerDisclosure/SkillsRankingJobSeekerDisclosure";
import SkillsRankingJobMarketDisclosure, {
  SKILLS_RANKING_JOB_MARKET_DISCLOSURE_MESSAGE_ID,
  SkillsRankingJobMarketDisclosureProps,
} from "src/features/skillsRanking/components/skillsRankingDisclosure/skillsRankingMarketDisclosure/SkillsRankingJobMarketDisclosure";
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
import { SkillsRankingState, SkillsRankingExperimentGroups } from "src/features/skillsRanking/types";

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

export const createJobSeekerDisclosureMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingJobSeekerDisclosureProps> => ({
  message_id: SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_MESSAGE_ID,
  type: SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingJobSeekerDisclosureProps) =>
    React.createElement(SkillsRankingJobSeekerDisclosure, props),
});

export const createJobMarketDisclosureMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>
): IChatMessage<SkillsRankingJobMarketDisclosureProps> => ({
  message_id: SKILLS_RANKING_JOB_MARKET_DISCLOSURE_MESSAGE_ID,
  type: SKILLS_RANKING_JOB_MARKET_DISCLOSURE_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingJobMarketDisclosureProps) =>
    React.createElement(SkillsRankingJobMarketDisclosure, props),
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
): IChatMessage<SkillsRankingPerceivedRankProps> => ({
  message_id: SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID,
  type: SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingPerceivedRankProps) => React.createElement(SkillsRankingPerceivedRank, props),
});

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
