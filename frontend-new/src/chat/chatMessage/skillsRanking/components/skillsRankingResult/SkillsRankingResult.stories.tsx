import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingResult from "src/chat/chatMessage/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import { ExperimentGroup, SkillsRankingState } from "src/chat/chatMessage/skillsRanking/types";
import { nanoid } from "nanoid";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { ChatMessageType } from "src/chat/Chat.types";
import { SkillsRankingService } from "src/chat/chatMessage/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

const meta: Meta<typeof SkillsRankingResult> = {
  title: "Chat/SkillsRanking/SkillsRankingResult",
  component: SkillsRankingResult,
  tags: ["autodocs"],
  args: {
    group: ExperimentGroup.GROUP_A,
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "",
      type: ChatMessageType.SKILLS_RANKING,
      reaction: null,
    },
  },
  decorators: [
    (Story) => {
      UserPreferencesStateService.getInstance().getActiveSessionId = () => 1234;
      SkillsRankingService.getInstance().getSkillsRankingState = async () => ({
        session_id: 1234,
        experiment_group: ExperimentGroup.GROUP_A,
        current_state: SkillsRankingState.EVALUATED,
        ranking: "80%",
        self_ranking: null,
      });
      return <Story />;
    },
  ],
};
export default meta;

type Story = StoryObj<typeof SkillsRankingResult>;

export const Shown: Story = {
  args: {},
};
