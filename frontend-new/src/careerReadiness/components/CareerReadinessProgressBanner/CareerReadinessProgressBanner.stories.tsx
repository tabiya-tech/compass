import type { Meta, StoryObj } from "@storybook/react";
import CareerReadinessProgressBanner from "src/careerReadiness/components/CareerReadinessProgressBanner/CareerReadinessProgressBanner";
import type { ModuleSummary } from "src/careerReadiness/types";

const meta: Meta<typeof CareerReadinessProgressBanner> = {
  title: "CareerReadiness/CareerReadinessProgressBanner",
  component: CareerReadinessProgressBanner,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof CareerReadinessProgressBanner>;

const baseModules: ModuleSummary[] = [
  {
    id: "1",
    title: "Professional Identity & Skills Mapping",
    description: "",
    icon: "identity",
    status: "COMPLETED",
    sort_order: 1,
    input_placeholder: "",
    active_conversation_id: null,
  },
  {
    id: "2",
    title: "CV Development",
    description: "",
    icon: "cv",
    status: "COMPLETED",
    sort_order: 2,
    input_placeholder: "",
    active_conversation_id: null,
  },
  {
    id: "3",
    title: "Cover Letter & Motivation Statement",
    description: "",
    icon: "letter",
    status: "NOT_STARTED",
    sort_order: 3,
    input_placeholder: "",
    active_conversation_id: null,
  },
  {
    id: "4",
    title: "Interview Preparation",
    description: "",
    icon: "interview",
    status: "NOT_STARTED",
    sort_order: 4,
    input_placeholder: "",
    active_conversation_id: null,
  },
  {
    id: "5",
    title: "Workplace Readiness",
    description: "",
    icon: "workplace",
    status: "NOT_STARTED",
    sort_order: 5,
    input_placeholder: "",
    active_conversation_id: null,
  },
];

export const TwoCompleted: Story = {
  args: { modules: baseModules },
};

export const NoneCompleted: Story = {
  args: {
    modules: baseModules.map((m) => ({
      ...m,
      status: "NOT_STARTED" as const,
    })),
  },
};

export const AllCompleted: Story = {
  args: {
    modules: baseModules.map((m) => ({ ...m, status: "COMPLETED" as const })),
  },
};
