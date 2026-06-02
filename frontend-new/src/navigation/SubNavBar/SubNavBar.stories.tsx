import type { Meta, StoryObj } from "@storybook/react";
import SubNavBar from "src/navigation/SubNavBar/SubNavBar";

const meta: Meta<typeof SubNavBar> = {
  title: "Navigation/SubNavBar",
  component: SubNavBar,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof SubNavBar>;

export const ChatEmerald: Story = {
  args: {
    title: "home.modules.skillsDiscovery",
    subtitle: "home.modules.skillsDiscoverySubtitle",
    headerColor: "primary",
  },
};

export const CareerExplorerRust: Story = {
  args: {
    title: "careerExplorer.title",
    subtitle: "careerExplorer.subtitle",
    headerColor: "primary",
  },
};

export const CareerReadinessAmber: Story = {
  args: {
    title: "careerReadiness.pageTitle",
    subtitle: "careerReadiness.pageDescription",
    headerColor: "secondary",
  },
};

export const CareerReadinessModuleLabelAbove: Story = {
  args: {
    title: "Get job ready — Module 1",
    subtitle: "Who You Are as a Professional",
    headerColor: "secondary",
    labelAbove: true,
  },
};
