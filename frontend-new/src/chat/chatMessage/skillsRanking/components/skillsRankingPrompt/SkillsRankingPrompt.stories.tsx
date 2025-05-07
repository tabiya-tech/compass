import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingPrompt from "src/chat/chatMessage/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import { ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { nanoid } from "nanoid";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { ChatMessageType } from "src/chat/Chat.types";

const meta: Meta<typeof SkillsRankingPrompt> = {
  title: "Chat/SkillsRanking/SkillsRankingPrompt",
  component: SkillsRankingPrompt,
  tags: ["autodocs"],
  argTypes: {
    onShowInfo: { action: "onShowInfo" },
    onContinue: { action: "onContinue" },
  },
  args: {
    group: ExperimentGroup.GROUP_A,
    disabled: false,
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "",
      type: ChatMessageType.SKILLS_RANKING_PROMPT,
      reaction: null,
      experimentGroup: ExperimentGroup.GROUP_A,
      onShowInfo: () => {},
      onContinue: () => {},
    },
  },
};

export default meta;

type Story = StoryObj<typeof SkillsRankingPrompt>;

export const Shown: Story = {
  args: {},
};
