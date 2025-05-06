import SkillsRankingChatMessage from "./SkillsRankingChatMessage";
import { Meta, StoryObj } from "@storybook/react";
import { ExperimentGroup } from "./types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { ChatMessageType } from "src/chat/Chat.types";
import { nanoid } from "nanoid";
import { SkillsRankingService } from "src/chat/chatMessage/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

const meta: Meta<typeof SkillsRankingChatMessage> = {
  title: "Chat/SkillsRanking/SkillsRankingChatMessage",
  component: SkillsRankingChatMessage,
  tags: ["autodocs"],
  args: {
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
      SkillsRankingService.getInstance().getRanking = async () => "Top 25%";
      return <Story />;
    }
  ]
}
export default meta;

type Story = StoryObj<typeof SkillsRankingChatMessage>;

export const Shown: Story = {
  args: {},
}
