import type { Meta, StoryObj } from "@storybook/react";
import HomeJobReadyList from "src/home/components/HomeJobReadyList/HomeJobReadyList";
import type { ModuleSummary } from "src/careerReadiness/types";

const base = (overrides: Partial<ModuleSummary>): ModuleSummary => ({
  id: "mod-1",
  title: "Who You Are as a Professional",
  description: "Discover your professional identity.",
  icon: "identity",
  status: "COMPLETED",
  sort_order: 1,
  input_placeholder: "",
  active_conversation_id: null,
  topics: [],
  ...overrides,
});

const meta: Meta<typeof HomeJobReadyList> = {
  title: "Home/HomeJobReadyList",
  component: HomeJobReadyList,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, padding: 24, background: "#fcf9f2" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof HomeJobReadyList>;

export const Loading: Story = {
  args: {
    modules: [],
    isLoading: true,
    loadError: false,
  },
};

export const LoadError: Story = {
  args: {
    modules: [],
    isLoading: false,
    loadError: true,
  },
};

export const Empty: Story = {
  args: {
    modules: [],
    isLoading: false,
    loadError: false,
  },
};

export const MixedStatuses: Story = {
  args: {
    modules: [
      base({ id: "a", title: "Who You Are as a Professional", status: "COMPLETED", sort_order: 1 }),
      base({ id: "b", title: "Building Your CV", status: "COMPLETED", sort_order: 2 }),
      base({
        id: "c",
        title: "Cover Letters & Motivation Statements",
        status: "IN_PROGRESS",
        sort_order: 3,
      }),
      base({ id: "d", title: "Interview Preparation", status: "NOT_STARTED", sort_order: 4 }),
      base({ id: "e", title: "Workplace Readiness", status: "NOT_STARTED", sort_order: 5 }),
    ],
    isLoading: false,
    loadError: false,
  },
};

export const UnlockedFirst: Story = {
  args: {
    modules: [
      base({ id: "u1", title: "First module", status: "UNLOCKED", sort_order: 1 }),
      base({ id: "u2", title: "Second module", status: "NOT_STARTED", sort_order: 2 }),
    ],
    isLoading: false,
    loadError: false,
  },
};
