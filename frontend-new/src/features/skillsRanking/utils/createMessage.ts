import React from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingPromptProps,
} from "src/features/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import { SkillsRankingVoteProps } from "src/features/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import {
  SkillsRankingResultProps,
} from "src/features/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import {
  CancellableTypingChatMessageProps,
} from "src/features/skillsRanking/components/cancellableTypingChatMessage/CancellableTypingChatMessage";
import { SkillsRankingMessageIds } from "../constants";

export type SkillsRankingMessageProps = 
  | SkillsRankingPromptProps 
  | SkillsRankingVoteProps 
  | SkillsRankingResultProps 
  | CancellableTypingChatMessageProps;

export const createMessage = <T extends SkillsRankingMessageProps>(
  type: string, 
  props: T, 
  Component: React.ComponentType<T>
): IChatMessage<T> => ({
  message_id: SkillsRankingMessageIds[type as keyof typeof SkillsRankingMessageIds],
  type,
  payload: props,
  sender: ConversationMessageSender.COMPASS,
  component: (props: T) => React.createElement(Component, props),
}); 