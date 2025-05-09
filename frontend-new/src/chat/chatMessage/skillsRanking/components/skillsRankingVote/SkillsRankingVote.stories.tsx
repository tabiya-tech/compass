import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingVote from "src/chat/chatMessage/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import { ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { nanoid } from "nanoid";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { ChatMessageType } from "src/chat/Chat.types";

const meta: Meta<typeof SkillsRankingVote> = {
  title: "Chat/SkillsRanking/SkillsRankingVote",
  component: SkillsRankingVote,
  tags: ["autodocs"],
  argTypes: {
    onRankSelect: { action: "onRankSelect" },
  },
  args: {
    group: ExperimentGroup.GROUP_A,
    disabled: false,
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "",
      type: ChatMessageType.SKILLS_RANKING,
      reaction: null,
    },
  },
};

export default meta;

type Story = StoryObj<typeof SkillsRankingVote>;

export const Shown: Story = {
  args: {
    group: ExperimentGroup.GROUP_A,
  },
};

export const ShownWhenDisabled: Story = {
  args: {
    group: ExperimentGroup.GROUP_A,
    disabled: true,
  },
};
