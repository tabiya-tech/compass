import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import HomeSidebar from "./HomeSidebar";
import { ExperiencesDrawerContext } from "src/experiences/ExperiencesDrawerProvider";
import type { ExperiencesDrawerContextType } from "src/experiences/ExperiencesDrawerProvider";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import type { Experience } from "src/experiences/experienceService/experiences.types";
import { UserProfileContext } from "src/profile/UserProfileContext";
import type { UseUserProfileResult } from "src/profile/hooks/useUserProfile";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeContext = (experiences: Experience[]): ExperiencesDrawerContextType => ({
  openExperiencesDrawer: async () => {},
  closeExperiencesDrawer: () => {},
  isDrawerOpen: false,
  experiences,
  conversationConductedAt: null,
  setConversationConductedAt: () => {},
  fetchExperiences: async () => {},
});

const makeExperience = (skills: string[]): Experience =>
  ({
    experience_title: "Shop assistant",
    exploration_phase: DiveInPhase.PROCESSED,
    top_skills: skills.map((label, i) => ({
      UUID: `skill-${i}`,
      preferredLabel: label,
      altLabels: [],
      description: "",
      orderIndex: i,
    })),
  }) as unknown as Experience;

const makeProfileContext = (programmeSkills: string[]): UseUserProfileResult => ({
  profileData: {
    name: null,
    email: null,
    termsAcceptedDate: null,
    language: null,
    location: null,
    school: null,
    program: null,
    year: null,
    skills: [],
    educationSkills: [],
    programmeSkills,
    modules: [],
    skillsInterestsProgress: 0,
    careerExplorerSectors: [],
  },
  isLoading: false,
  isLoadingSecurity: false,
  isLoadingPreferences: false,
  isLoadingProfile: false,
  isLoadingSkills: false,
  isLoadingModules: false,
  isLoadingCareerExplorer: false,
  errors: {
    security: null,
    preferences: null,
    profile: null,
    skills: null,
    modules: null,
    careerExplorer: null,
  },
});

const meta: Meta<typeof HomeSidebar> = {
  title: "Home/Sidebar/Home",
  component: HomeSidebar,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ height: "700px", display: "flex", justifyContent: "flex-end" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof HomeSidebar>;

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Empty: Story = {
  name: "Empty — no skills yet",
  decorators: [
    (Story) => (
      <UserProfileContext.Provider value={makeProfileContext([])}>
        <ExperiencesDrawerContext.Provider value={makeContext([])}>
          <Story />
        </ExperiencesDrawerContext.Provider>
      </UserProfileContext.Provider>
    ),
  ],
};

export const WithWorkSkills: Story = {
  name: "With work skills",
  decorators: [
    (Story) => (
      <UserProfileContext.Provider value={makeProfileContext([])}>
        <ExperiencesDrawerContext.Provider
          value={makeContext([
            makeExperience([
              "Record keeping",
              "Planning & organisation",
              "Customer communication",
              "Teamwork",
              "Leadership",
              "Land management",
            ]),
          ])}
        >
          <Story />
        </ExperiencesDrawerContext.Provider>
      </UserProfileContext.Provider>
    ),
  ],
};

export const WithBothSkills: Story = {
  name: "With both skill sets",
  decorators: [
    (Story) => (
      <UserProfileContext.Provider
        value={makeProfileContext([
          "Professional communication",
          "CV writing",
          "Interview skills",
          "Cover letter writing",
        ])}
      >
        <ExperiencesDrawerContext.Provider
          value={makeContext([
            makeExperience([
              "Record keeping",
              "Planning & organisation",
              "Customer communication",
              "Teamwork",
              "Leadership",
              "Land management",
              "Numeracy",
              "Event coordination",
              "Stock control",
            ]),
          ])}
        >
          <Story />
        </ExperiencesDrawerContext.Provider>
      </UserProfileContext.Provider>
    ),
  ],
};
