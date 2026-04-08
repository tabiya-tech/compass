import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import HomeSidebar from "./HomeSidebar";
import SidebarService from "./SidebarService";
import { ExperiencesDrawerContext } from "src/experiences/ExperiencesDrawerProvider";
import type { ExperiencesDrawerContextType } from "src/experiences/ExperiencesDrawerProvider";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import type { Experience } from "src/experiences/experienceService/experiences.types";

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
    (Story) => {
      SidebarService.getInstance().getProgrammeSkills = async () => [];
      return (
        <ExperiencesDrawerContext.Provider value={makeContext([])}>
          <Story />
        </ExperiencesDrawerContext.Provider>
      );
    },
  ],
};

export const WithWorkSkills: Story = {
  name: "With work skills",
  decorators: [
    (Story) => {
      SidebarService.getInstance().getProgrammeSkills = async () => [];
      return (
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
      );
    },
  ],
};

export const WithBothSkills: Story = {
  name: "With both skill sets",
  decorators: [
    (Story) => {
      SidebarService.getInstance().getProgrammeSkills = async () => [
        "Professional communication",
        "CV writing",
        "Interview skills",
        "Cover letter writing",
      ];
      return (
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
      );
    },
  ],
};
