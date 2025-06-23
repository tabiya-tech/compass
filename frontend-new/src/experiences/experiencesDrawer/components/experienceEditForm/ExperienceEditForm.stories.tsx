import { Meta } from "@storybook/react/*";
import ExperienceEditForm from "./ExperienceEditForm";
import { generateRandomExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";

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
