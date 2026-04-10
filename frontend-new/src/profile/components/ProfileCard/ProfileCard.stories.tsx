import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ProfileCard } from "./ProfileCard";
import { ExperiencesDrawerContext } from "src/experiences/ExperiencesDrawerProvider";
import type { ExperiencesDrawerContextType } from "src/experiences/ExperiencesDrawerProvider";

const experiencesDrawerStoryContext: ExperiencesDrawerContextType = {
  openExperiencesDrawer: async () => {},
  closeExperiencesDrawer: () => {},
  isDrawerOpen: false,
  experiences: [],
  conversationConductedAt: null,
  setConversationConductedAt: () => {},
  fetchExperiences: async () => {},
};

const meta: Meta<typeof ProfileCard> = {
  title: "Profile/Components/ProfileCard",
  component: ProfileCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ExperiencesDrawerContext.Provider value={experiencesDrawerStoryContext}>
        <Story />
      </ExperiencesDrawerContext.Provider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ProfileCard>;

export const Default: Story = {
  args: {
    name: "John Banda",
    location: "Lusaka, Zambia",
    school: "Lusaka TEVET College",
    program: "General Agriculture",
    year: "Year 2",
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    name: "John Doe",
    location: "Lusaka, Zambia",
    school: "University of Zambia",
    program: "Computer Science",
    year: "Third Year",
    isLoading: true,
  },
};

export const EmptyProfile: Story = {
  args: {
    name: null,
    location: null,
    school: null,
    program: null,
    year: null,
    isLoading: false,
  },
};

export const PartialData: Story = {
  args: {
    name: "Jane Smith",
    location: "Ndola, Zambia",
    school: null,
    program: null,
    year: "First Year",
    isLoading: false,
  },
};

export const LongValues: Story = {
  args: {
    name: "Dr. Alexander Christopher Montgomery-Wellington III",
    location: "Livingstone, Southern Province, Zambia",
    school: "Copperbelt University of Science and Technology",
    program: "Bachelor of Science in Computer Engineering and Information Technology",
    year: "Fourth Year (Final Year)",
    isLoading: false,
  },
};
