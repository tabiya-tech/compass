import { ConversationMessage, MessageReaction } from "./ChatService/ChatService.types";
import { ExperimentGroup, RankValue } from "./chatMessage/skillsRanking/types";

export enum ChatMessageType {
  BASIC_CHAT = "basic_chat",
  CONVERSATION_CONCLUSION = "conversation_conclusion",
  TYPING = "typing",
  ERROR = "error",
  SKILLS_RANKING = "skills_ranking",
  SKILLS_RANKING_PROMPT = "skills_ranking_prompt",
  SKILLS_RANKING_VOTE = "skills_ranking_vote",
  SKILLS_RANKING_RESULT = "skills_ranking_result",
}

export type IChatMessage = ConversationMessage & {
  type: ChatMessageType;
  reaction: MessageReaction | null;
};

export interface ISkillsRankingPromptMessage extends IChatMessage {
  type: ChatMessageType.SKILLS_RANKING_PROMPT;
  experimentGroup: ExperimentGroup;
  onShowInfo: () => void;
  onContinue: () => void;
}

export interface ISkillsRankingVoteMessage extends IChatMessage {
  type: ChatMessageType.SKILLS_RANKING_VOTE;
  experimentGroup: ExperimentGroup;
  onRankSelect: (rank: RankValue) => void;
  error: string | null;
}

export interface ISkillsRankingResultMessage extends IChatMessage {
  type: ChatMessageType.SKILLS_RANKING_RESULT;
  experimentGroup: ExperimentGroup;
  rank: string;
  error: string | null;
}
