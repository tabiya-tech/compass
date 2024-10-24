import type { Meta, StoryObj } from "@storybook/react";
import ChatHeader from "./ChatHeader";

const meta: Meta<typeof ChatHeader> = {
  title: "Chat/ChatHeader",
  component: ChatHeader,
  tags: ["autodocs"],
  argTypes: {
    notifyOnLogout: { action: "notifyOnLogout" },
    notifyOnExperiencesDrawerOpen: { action: "notifyOnExperiencesDrawerOpen" },
    setExploredExperiencesNotification: { action: "setExploredExperiencesNotification" },
  },
};

export default meta;

type Story = StoryObj<typeof ChatHeader>;

export const Shown: Story = {
  args: {},
};

export const ShownWithNotification: Story = {
  args: {
    exploredExperiencesNotification: true,
    experiencesExplored: 3,
  },
};
