import { Meta, StoryObj } from "@storybook/react";
import ChatMessageFooter from "src/chat/chatMessageFooter/ChatMessageFooter";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

const meta: Meta<typeof ChatMessageFooter> = {
  title: "Chat/ChatMessageFooter",
  component: ChatMessageFooter,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof ChatMessageFooter>;

export const Shown: Story = {
  args: {
    children: <PrimaryButton> Click here </PrimaryButton>,
  },
};
