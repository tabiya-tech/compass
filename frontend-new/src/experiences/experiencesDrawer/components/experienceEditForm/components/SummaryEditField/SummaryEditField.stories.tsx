import type { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";

import SummaryEditField from "src/experiences/experiencesDrawer/components/experienceEditForm/components/SummaryEditField/SummaryEditField";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import ExperienceService from "src/experiences/experienceService/experienceService";

const meta: Meta<typeof SummaryEditField> = {
  title: "Experiences/ExperienceEditForm/SummaryEditField",
  component: SummaryEditField,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      // Mock AuthenticationStateService
      const mockUserPreferencesStateService = UserPreferencesStateService.getInstance();
      mockUserPreferencesStateService.getActiveSessionId = () => 1234;

      const mockExperienceService = {
        getOriginalExperience: () => ({
          uuid: "1234",
          summary: "This is the original summary of the experience.".repeat(15),
        }),
        updateExperience: (sessionId: number, experience_uuid: string, data: { summary: string }) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ...data,
                uuid: experience_uuid,
              });
            }, 1000);
          });
        },
      };
      // @ts-ignore
      ExperienceService.getInstance().getUneditedExperience = mockExperienceService.getOriginalExperience;
      // @ts-ignore
      ExperienceService.getInstance().updateExperience = mockExperienceService.updateExperience;

      return (
        <div style={{ width: "40%", padding: "20px" }}>
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof SummaryEditField>;

export const Shown: Story = {
  args: {
    summary: "This is a summary of the experience.",
    notifyOnChange: action("notifyOnChange"),
  },
};

export const ShownWithLongText: Story = {
  args: {
    summary: "This is a summary of the experience. ".repeat(15),
    notifyOnChange: action("notifyOnChange"),
  },
};

export const Empty: Story = {
  args: {
    summary: "",
    notifyOnChange: action("notifyOnChange"),
  },
};

export const Error: Story = {
  args: {
    summary: "This is a summary of the experience.",
    notifyOnChange: action("notifyOnChange"),
    error: "An error has occurred",
  },
};

export const Disabled: Story = {
  args: {
    summary: "This is a summary of the experience.",
    notifyOnChange: action("notifyOnChange"),
  },
};
