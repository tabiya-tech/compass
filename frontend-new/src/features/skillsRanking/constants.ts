import { SKILLS_RANKING_PROMPT_MESSAGE_TYPE } from "src/features/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import { SKILLS_RANKING_VOTE_MESSAGE_TYPE } from "src/features/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import { SKILLS_RANKING_RESULT_MESSAGE_TYPE } from "src/features/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import {
  CANCELABLE_TYPING_CHAT_MESSAGE_TYPE,
} from "src/features/skillsRanking/components/cancellableTypingChatMessage/CancellableTypingChatMessage";

// default timeout value for typing messages between the steps
export const TYPING_TIMEOUT = 5000; // 5 seconds
// default timeout value for cancelable typing messages
export const CANCELABLE_TYPING_TIMEOUT = 10000; // 10 seconds
// artificial delay after the results are shown before the next step can be initiated
export const DELAY_AFTER_RESULTS = 3000; // 3 seconds

// fixed message ids for adding and removing specific messages in the chat for each type of skills ranking message
export const SkillsRankingMessageIds = {
  [SKILLS_RANKING_PROMPT_MESSAGE_TYPE]: "skills-ranking-prompt-message",
  [SKILLS_RANKING_VOTE_MESSAGE_TYPE]: "skills-ranking-vote-message",
  [SKILLS_RANKING_RESULT_MESSAGE_TYPE]: "skills-ranking-result-message",
  [CANCELABLE_TYPING_CHAT_MESSAGE_TYPE]: "skills-ranking-cancellable-typing-message",
} as const;