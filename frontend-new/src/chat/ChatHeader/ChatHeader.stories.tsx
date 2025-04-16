import type { Meta, StoryObj } from "@storybook/react";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import ChatHeader from "src/chat/ChatHeader/ChatHeader";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import authenticationStateService from "src/auth/services/AuthenticationState.service";

const meta: Meta<typeof ChatHeader> = {
  title: "Chat/ChatHeader",
  component: ChatHeader,
  tags: ["autodocs"],
  argTypes: {
    notifyOnLogout: { action: "notifyOnLogout" },
    setExploredExperiencesNotification: { action: "setExploredExperiencesNotification" },
  },
  decorators: [
    (Story) => {
      authenticationStateService.getInstance().getUser = () => ({
        id: "123",
        name: "Foo Bar",
        email: "foo@bar.baz",
      });
      // Mock the methods to always show the feedback notification
      PersistentStorageService.hasSeenFeedbackNotification = () => false;
      PersistentStorageService.setSeenFeedbackNotification = () => {};
      return Story();
    },
  ],
};

export default meta;

type Story = StoryObj<typeof ChatHeader>;

export const Shown: Story = {
  args: {
    exploredExperiencesNotification: false,
    experiencesExplored: 0,
    conversationCompleted: false,
    progressPercentage: 0,
    timeUntilNotification: null,
  },
};

export const ShownWithExperiencesNotification: Story = {
  args: {
    exploredExperiencesNotification: true,
    experiencesExplored: mockExperiences.length,
    conversationCompleted: false,
    progressPercentage: 0,
    timeUntilNotification: null,
  },
};

export const ShownWithFeedbackNotification: Story = {
  args: {
    exploredExperiencesNotification: false,
    conversationCompleted: false,
    experiencesExplored: 0,
    progressPercentage: 10,
    timeUntilNotification: 0,
  },
};
