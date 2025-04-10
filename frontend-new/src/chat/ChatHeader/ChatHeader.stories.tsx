import type { Meta, StoryObj } from "@storybook/react";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import ChatHeader from "src/chat/ChatHeader/ChatHeader";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

const meta: Meta<typeof ChatHeader> = {
  title: "Chat/ChatHeader",
  component: ChatHeader,
  tags: ["autodocs"],
  argTypes: {
    notifyOnLogout: { action: "notifyOnLogout" },
    notifyOnExperiencesDrawerOpen: { action: "notifyOnExperiencesDrawerOpen" },
    setExploredExperiencesNotification: { action: "setExploredExperiencesNotification" },
  },
  decorators: [
    (Story) => {
      UserPreferencesStateService.getInstance().getActiveSessionId = () => 1234;
      // Mock the methods to always show the feedback notification
      PersistentStorageService.getFeedbackNotification = () => false;
      PersistentStorageService.setFeedbackNotification = () => {};
      return Story();
    },
  ],
};

export default meta;

type Story = StoryObj<typeof ChatHeader>;

export const Shown: Story = {
  args: {
    experiences: mockExperiences,
    experiencesExplored: mockExperiences.length,
  },
};

export const ShownWithExperiencesNotification: Story = {
  args: {
    exploredExperiencesNotification: true,
    experiencesExplored: mockExperiences.length,
    experiences: mockExperiences,
  },
};

export const ShownWithFeedbackNotification: Story = {
  args: {
    conversationCompleted: false,
    experiencesExplored: 0,
    experiences: mockExperiences,
    conversationConductedAt: new Date(Date.now() - 1500).toISOString(),
    conversationState: 10,
  },
};
