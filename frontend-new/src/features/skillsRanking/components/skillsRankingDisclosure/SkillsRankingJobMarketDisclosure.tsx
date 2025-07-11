import React, { useMemo } from "react";

import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { SkillsRankingExperimentGroups, SkillsRankingState } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "../../skillsRankingService/skillsRankingService";

const uniqueId = "579104a2-f36b-4ca5-a0c5-b2b44aaa52e1";

export const DATA_TEST_ID = {
  SKILLS_RANKING_JOB_MARKET_DISCLOSURE_CONTAINER: `skills-ranking-job-market-disclosure-container-${uniqueId}`,
};

export const SKILLS_RANKING_JOB_MARKET_DISCLOSURE_MESSAGE_ID = `skills-ranking-job-market-disclosure-message-${uniqueId}`;

export interface SkillsRankingJobMarketDisclosureProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingJobSeekerDisclosure: React.FC<Readonly<SkillsRankingJobMarketDisclosureProps>> = ({
  skillsRankingState,
}) => {

  const jobPlatformUrl = useMemo(() => (
    SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl
  ), [])

  const message = useMemo(() => {
    switch (skillsRankingState.experiment_group){
      case SkillsRankingExperimentGroups.GROUP_1:
      case SkillsRankingExperimentGroups.GROUP_3:
        return `With your current skillset you fulfill the required & most relevant skills of ${skillsRankingState.score.jobs_matching_rank}% of jobs on SAYouth.mobi. This is a quite some jobs!`;
      case SkillsRankingExperimentGroups.GROUP_2:
      case SkillsRankingExperimentGroups.GROUP_4:
        return `We've gathered the relevant information, but we need to run a few more checks on the opportunities listed on ${jobPlatformUrl} to make sure we give you the most accurate and up-to-date details. We'll notify you as soon as everything is ready. In the meantime, feel free to bring this up during our next phone survey -- we’d be happy to revisit it with you then. Thanks for your patience!`;
      default:
        return `With your current skillset you fulfill the required & most relevant skills of ${skillsRankingState.score.jobs_matching_rank}% of jobs on SAYouth.mobi. This is a decent number of jobs!`;
    }
  }, [skillsRankingState.score.jobs_matching_rank, skillsRankingState.experiment_group, jobPlatformUrl]);

  return (
    <MessageContainer origin={ConversationMessageSender.COMPASS} data-testid={DATA_TEST_ID.SKILLS_RANKING_JOB_MARKET_DISCLOSURE_CONTAINER}>
      <ChatBubble message={message} sender={ConversationMessageSender.COMPASS}>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingJobSeekerDisclosure;
