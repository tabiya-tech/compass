import type { Meta, StoryObj } from "@storybook/react";
import CareerReadinessSidebar from "./CareerReadinessSidebar";

const meta: Meta<typeof CareerReadinessSidebar> = {
  title: "Home/Sidebar/CareerReadiness",
  component: CareerReadinessSidebar,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ height: "600px", display: "flex", justifyContent: "flex-end" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CareerReadinessSidebar>;

const CV_TOPICS = ["What is a CV?", "CV Structure", "CV Writing Tips", "Common Mistakes to Avoid"];

export const NoProgress: Story = {
  name: "No progress",
  args: {
    moduleId: "cv-development",
    coveredTopics: [],
  },
};

export const InProgress: Story = {
  name: "In progress",
  args: {
    moduleId: "cv-development",
    coveredTopics: [CV_TOPICS[0], CV_TOPICS[1]],
  },
};

export const Complete: Story = {
  args: {
    moduleId: "cv-development",
    coveredTopics: CV_TOPICS,
  },
};
