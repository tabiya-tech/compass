import type { Meta, StoryObj } from "@storybook/react";
import CareerReadinessModuleCard from "src/careerReadiness/components/CareerReadinessModuleCard/CareerReadinessModuleCard";
import type { ModuleSummary } from "src/careerReadiness/types";
import type { ModuleStatusDisplay } from "src/careerReadiness/types";

const meta: Meta<typeof CareerReadinessModuleCard> = {
  title: "CareerReadiness/CareerReadinessModuleCard",
  component: CareerReadinessModuleCard,
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["unlocked", "in_progress", "done"],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400, minHeight: 200 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CareerReadinessModuleCard>;

const mockModule: ModuleSummary = {
  id: "cv-development",
  title: "CV Development",
  description:
    "Learn to build and tailor a professional CV that highlights your skills and experience for different employers.",
  icon: "cv",
  status: "NOT_STARTED",
  sort_order: 1,
  input_placeholder: "Ask about CVs...",
  active_conversation_id: null,
};

export const NotStarted: Story = {
  args: {
    module: mockModule,
    status: "unlocked" as ModuleStatusDisplay,
  },
};

export const InProgress: Story = {
  args: {
    module: { ...mockModule, status: "IN_PROGRESS" },
    status: "in_progress" as ModuleStatusDisplay,
  },
};

export const Done: Story = {
  args: {
    module: { ...mockModule, status: "COMPLETED" },
    status: "done" as ModuleStatusDisplay,
  },
};
