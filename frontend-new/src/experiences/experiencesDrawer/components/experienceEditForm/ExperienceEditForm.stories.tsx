import { Meta } from "@storybook/react/*";
import ExperienceEditForm from "./ExperienceEditForm";
import { generateRandomExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import {
  EXPERIENCE_TITLE_MAX_LENGTH,
  COMPANY_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  SUMMARY_MAX_LENGTH,
  TIMELINE_MAX_LENGTH,
} from "src/experiences/experienceService/experiences.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import ExperienceService from "src/experiences/experienceService/experienceService";

const meta: Meta<typeof ExperienceEditForm> = {
  title: "Experiences/ExperienceEditForm",
  component: ExperienceEditForm,
  tags: ["autodocs"],
  argTypes: {
    notifyOnSave: { action: "saved" },
    notifyOnCancel: { action: "cancel" },
    notifyOnUnsavedChange: { action: "unsavedChangesChanged" },
  },
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

      return <Story />;
    },
  ],
};

export default meta;

type Story = Meta<typeof ExperienceEditForm>;

export const Shown: Story = {
  args: {
    experience: generateRandomExperiences(2)[0],
  },
};

export const FieldOverflowError: Story = {
  args: {
    experience: {
      ...generateRandomExperiences(1)[0],
      experience_title: "x".repeat(EXPERIENCE_TITLE_MAX_LENGTH + 5),
      company: "y".repeat(COMPANY_MAX_LENGTH + 5),
      location: "z".repeat(LOCATION_MAX_LENGTH + 5),
      summary: "s".repeat(SUMMARY_MAX_LENGTH + 5),
      timeline: {
        start: "s".repeat(TIMELINE_MAX_LENGTH + 5),
        end: "e".repeat(TIMELINE_MAX_LENGTH + 5),
      },
    },
  },
};
