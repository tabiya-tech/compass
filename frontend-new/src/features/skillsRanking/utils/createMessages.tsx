import React from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

import SkillsRankingBriefing, { SKILLS_RANKING_BRIEFING_MESSAGE_ID, SkillsRankingBriefingProps } from "../components/skillsRankingBriefing/SkillsRankingBriefing";
import SkillsRankingJobSeekerDisclosure, { SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_MESSAGE_ID, SkillsRankingJobSeekerDisclosureProps } from "../components/skillsRankingDisclosure/skillsRankingJobSeekerDisclosure/SkillsRankingJobSeekerDisclosure";
import SkillsRankingJobMarketDisclosure, { SKILLS_RANKING_JOB_MARKET_DISCLOSURE_MESSAGE_ID, SkillsRankingJobMarketDisclosureProps } from "../components/skillsRankingDisclosure/skillsRankingMarketDisclosure/SkillsRankingJobMarketDisclosure";
import SkillsRankingPrompt, { SKILLS_RANKING_PROMPT_MESSAGE_ID, SkillsRankingPromptProps } from "../components/skillsRankingPrompt/SkillsRankingPrompt";
import SkillsRankingRetypedRank, { SKILLS_RANKING_RETYPED_RANK_MESSAGE_ID, SkillsRankingRetypedRankProps } from "../components/skillsRankingRetypedRank/SkillsRankingRetypedRank";
import SkillsRankingPerceivedRank, { SKILLS_RANKING_PERCEIVED_RANK_MESSAGE_ID, SkillsRankingPerceivedRankProps } from "../components/skillsRankingPerceivedRank/SkillsRankingPerceivedRank";
import SkillsRankingProofOfValue, { SKILLS_RANKING_EFFORT_MESSAGE_ID, SkillsRankingEffortProps } from "../components/skillsRankingProofOfValue/SkillsRankingProofOfValue";
import { SkillsRankingState } from "../types";

export const createBriefingMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>,
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
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>,
): IChatMessage<SkillsRankingJobSeekerDisclosureProps> => ({
  message_id: SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_MESSAGE_ID,
  type: SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingJobSeekerDisclosureProps) => React.createElement(SkillsRankingJobSeekerDisclosure, props),
});

export const createJobMarketDisclosureMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>,
): IChatMessage<SkillsRankingJobMarketDisclosureProps> => ({
  message_id: SKILLS_RANKING_JOB_MARKET_DISCLOSURE_MESSAGE_ID,
  type: SKILLS_RANKING_JOB_MARKET_DISCLOSURE_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingJobMarketDisclosureProps) => React.createElement(SkillsRankingJobMarketDisclosure, props),
});

export const createPromptMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>,
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
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>,
): IChatMessage<SkillsRankingRetypedRankProps> => ({
  message_id: SKILLS_RANKING_RETYPED_RANK_MESSAGE_ID,
  type: SKILLS_RANKING_RETYPED_RANK_MESSAGE_ID,
  payload: {
    skillsRankingState,
    onFinish,
  },
  sender: ConversationMessageSender.COMPASS,
  component: (props: SkillsRankingRetypedRankProps) => React.createElement(SkillsRankingRetypedRank, props),
});

export const createPerceivedRankMessage = (
  skillsRankingState: SkillsRankingState,
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>,
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
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>,
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