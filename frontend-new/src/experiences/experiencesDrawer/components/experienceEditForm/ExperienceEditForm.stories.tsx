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

const meta: Meta<typeof ExperienceEditForm> = {
  title: "Experiences/ExperienceEditForm",
  component: ExperienceEditForm,
  tags: ["autodocs"],
  argTypes: {
    notifyOnSave: { action: "saved" },
    notifyOnCancel: { action: "cancel" },
    notifyOnUnsavedChange: { action: "unsavedChangesChanged" },
  },
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
