import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import NavBar from "src/navigation/NavBar/NavBar";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { UserProfileContext } from "src/profile/UserProfileContext";
import type { UseUserProfileResult } from "src/profile/hooks/useUserProfile";

const mockProfileContext: UseUserProfileResult = {
  profileData: {
    name: "Bupe Phiri",
    email: "bupe.phiri@example.com",
    termsAcceptedDate: null,
    language: null,
    location: null,
    school: null,
    program: null,
    year: null,
    skills: [],
    educationSkills: [],
    programmeSkills: [],
    totalExperiences: 0,
    exploredExperiences: 0,
    modules: [],
    skillsInterestsProgress: 0,
    careerExplorerSectors: [],
  },
  refreshProfileData: () => {},
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
  refreshModules: () => {},
};

const meta: Meta<typeof NavBar> = {
  title: "Navigation/NavBar",
  component: NavBar,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      authenticationStateService.getInstance().getUser = () => ({
        id: "user-123",
        name: "Bupe Phiri",
        email: "bupe.phiri@example.com",
      });
      return (
        <UserProfileContext.Provider value={mockProfileContext}>
          <Story />
        </UserProfileContext.Provider>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof NavBar>;

export const Primary: Story = {
  args: { headerColor: "primary" },
};

export const Secondary: Story = {
  args: { headerColor: "secondary" },
};

export const Tertiary: Story = {
  args: { headerColor: "tertiary" },
};
